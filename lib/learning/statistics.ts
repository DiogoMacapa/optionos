import type { Operation } from '@/lib/types/database';

/**
 * Estatísticas de aprendizado — não é machine learning, é análise
 * estatística agregada sobre o histórico real de operações do usuário.
 * Considera apenas operações FECHADAS (encerrada, exercida, rolada) —
 * abertas ainda não têm resultado definitivo.
 */

const CLOSED_STATUSES = new Set(['encerrada', 'exercida', 'rolada']);

function closedOperations(operations: Operation[]): Operation[] {
  return operations.filter((o) => CLOSED_STATUSES.has(o.status) && o.net_profit !== null);
}

export interface AssetProfitStat {
  ticker: string;
  totalProfit: number;
  operationsCount: number;
  avgProfit: number;
}

/** Ativo mais lucrativo: soma o lucro líquido de todas as operações fechadas, por ativo. */
export function mostProfitableAssets(operations: Operation[]): AssetProfitStat[] {
  const closed = closedOperations(operations);
  const byAsset = new Map<string, { total: number; count: number }>();

  for (const op of closed) {
    const ticker = op.asset?.ticker ?? '—';
    const entry = byAsset.get(ticker) ?? { total: 0, count: 0 };
    entry.total += op.net_profit ?? 0;
    entry.count += 1;
    byAsset.set(ticker, entry);
  }

  return Array.from(byAsset.entries())
    .map(([ticker, { total, count }]) => ({
      ticker,
      totalProfit: total,
      operationsCount: count,
      avgProfit: count > 0 ? total / count : 0,
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit);
}

export interface OverallStats {
  averagePremium: number | null;
  exerciseRatePct: number | null;
  successRatePct: number | null;
  averageProfit: number | null;
  operationsCount: number;
}

/** Estatísticas gerais: prêmio médio, taxa de exercício, taxa de sucesso, lucro médio. */
export function overallStats(operations: Operation[]): OverallStats {
  const closed = closedOperations(operations);
  const count = closed.length;

  if (count === 0) {
    return { averagePremium: null, exerciseRatePct: null, successRatePct: null, averageProfit: null, operationsCount: 0 };
  }

  const totalPremium = closed.reduce((sum, o) => sum + o.premium_received, 0);
  const totalProfit = closed.reduce((sum, o) => sum + (o.net_profit ?? 0), 0);
  const exercisedCount = closed.filter((o) => o.exercised_label === 'Sim').length;
  const successCount = closed.filter((o) => (o.net_profit ?? 0) > 0).length;

  return {
    averagePremium: totalPremium / count,
    exerciseRatePct: (exercisedCount / count) * 100,
    successRatePct: (successCount / count) * 100,
    averageProfit: totalProfit / count,
    operationsCount: count,
  };
}

export interface DeltaBandStat {
  label: string; // ex: "0,10 – 0,15"
  avgProfit: number;
  operationsCount: number;
}

const DELTA_BAND_SIZE = 0.05;

/**
 * Delta mais lucrativo: como delta é contínuo (não categórico), agrupa
 * em faixas de 0,05 (ex: 0,10–0,15, 0,15–0,20...) e calcula o lucro
 * médio de cada faixa. Só considera operações com delta_at_open salvo.
 */
export function mostProfitableDeltaBands(operations: Operation[]): DeltaBandStat[] {
  const closed = closedOperations(operations).filter((o) => o.delta_at_open !== null);
  const byBand = new Map<number, { total: number; count: number }>();

  for (const op of closed) {
    const delta = Math.abs(op.delta_at_open as number);
    const bandIndex = Math.floor(delta / DELTA_BAND_SIZE);
    const entry = byBand.get(bandIndex) ?? { total: 0, count: 0 };
    entry.total += op.net_profit ?? 0;
    entry.count += 1;
    byBand.set(bandIndex, entry);
  }

  return Array.from(byBand.entries())
    .map(([bandIndex, { total, count }]) => {
      const low = bandIndex * DELTA_BAND_SIZE;
      const high = low + DELTA_BAND_SIZE;
      return {
        label: `${low.toFixed(2).replace('.', ',')} – ${high.toFixed(2).replace('.', ',')}`,
        avgProfit: count > 0 ? total / count : 0,
        operationsCount: count,
      };
    })
    .sort((a, b) => b.avgProfit - a.avgProfit);
}

export interface WeekdayStat {
  weekday: string; // "Segunda", "Terça"...
  avgProfit: number;
  operationsCount: number;
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Melhor dia da semana para ABRIR a operação (não o vencimento — o
 * usuário quer saber em que dia ele tende a conseguir os melhores
 * prêmios/resultados quando decide vender).
 */
export function bestOpeningWeekdays(operations: Operation[]): WeekdayStat[] {
  const closed = closedOperations(operations);
  const byWeekday = new Map<number, { total: number; count: number }>();

  for (const op of closed) {
    const weekday = new Date(op.opened_at.slice(0, 10) + 'T00:00:00').getDay();
    const entry = byWeekday.get(weekday) ?? { total: 0, count: 0 };
    entry.total += op.net_profit ?? 0;
    entry.count += 1;
    byWeekday.set(weekday, entry);
  }

  return Array.from(byWeekday.entries())
    .map(([weekday, { total, count }]) => ({
      weekday: WEEKDAY_NAMES[weekday],
      avgProfit: count > 0 ? total / count : 0,
      operationsCount: count,
    }))
    .sort((a, b) => b.avgProfit - a.avgProfit);
}

export interface HoldingPeriodStat {
  label: string; // ex: "1–3 dias"
  avgProfit: number;
  operationsCount: number;
}

/**
 * Melhor prazo: quantos dias entre abertura e vencimento rendem mais
 * prêmio/lucro em média. Agrupa em faixas (1-3, 4-7, 8-14, 15-21, 22+)
 * em vez de dia exato, que teria pouquíssimas repetições.
 */
export function bestHoldingPeriods(operations: Operation[]): HoldingPeriodStat[] {
  const closed = closedOperations(operations);
  const bands: { label: string; min: number; max: number }[] = [
    { label: '1–3 dias', min: 1, max: 3 },
    { label: '4–7 dias', min: 4, max: 7 },
    { label: '8–14 dias', min: 8, max: 14 },
    { label: '15–21 dias', min: 15, max: 21 },
    { label: '22+ dias', min: 22, max: Infinity },
  ];

  const byBand = new Map<string, { total: number; count: number }>();

  for (const op of closed) {
    const opened = new Date(op.opened_at.slice(0, 10) + 'T00:00:00');
    const expiration = new Date(op.expiration + 'T00:00:00');
    const days = Math.round((expiration.getTime() - opened.getTime()) / 86400000);
    const band = bands.find((b) => days >= b.min && days <= b.max);
    if (!band) continue;
    const entry = byBand.get(band.label) ?? { total: 0, count: 0 };
    entry.total += op.net_profit ?? 0;
    entry.count += 1;
    byBand.set(band.label, entry);
  }

  return bands
    .filter((b) => byBand.has(b.label))
    .map((b) => {
      const { total, count } = byBand.get(b.label)!;
      return { label: b.label, avgProfit: count > 0 ? total / count : 0, operationsCount: count };
    })
    .sort((a, b) => b.avgProfit - a.avgProfit);
}

