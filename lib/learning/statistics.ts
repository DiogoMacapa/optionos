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
 * Melhor vencimento: agrupa pelo dia da semana do vencimento (mais
 * acionável do que a data exata, que nunca se repete) e calcula o
 * lucro médio por dia da semana.
 */
export function bestExpirationWeekdays(operations: Operation[]): WeekdayStat[] {
  const closed = closedOperations(operations);
  const byWeekday = new Map<number, { total: number; count: number }>();

  for (const op of closed) {
    const weekday = new Date(op.expiration + 'T00:00:00').getDay();
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

export interface StrikeDistanceBandStat {
  label: string; // ex: "5% – 10% OTM"
  avgProfit: number;
  operationsCount: number;
}

const DISTANCE_BAND_SIZE = 0.05; // 5 pontos percentuais

/**
 * Melhores strikes: como strike em si não é comparável entre ativos
 * de preços diferentes, usa a Distância do strike (% OTM em relação
 * à cotação no momento do registro) agrupada em faixas de 5%.
 */
export function bestStrikeDistanceBands(operations: Operation[]): StrikeDistanceBandStat[] {
  const closed = closedOperations(operations).filter(
    (o) => o.reference_quote !== null && o.reference_quote !== undefined && o.reference_quote > 0
  );
  const byBand = new Map<number, { total: number; count: number }>();

  for (const op of closed) {
    const quote = op.reference_quote as number;
    const distance = (quote - op.strike) / quote; // positivo = OTM (strike abaixo da cotação, para PUT)
    const bandIndex = Math.floor(distance / DISTANCE_BAND_SIZE);
    const entry = byBand.get(bandIndex) ?? { total: 0, count: 0 };
    entry.total += op.net_profit ?? 0;
    entry.count += 1;
    byBand.set(bandIndex, entry);
  }

  return Array.from(byBand.entries())
    .map(([bandIndex, { total, count }]) => {
      const low = bandIndex * DISTANCE_BAND_SIZE * 100;
      const high = low + DISTANCE_BAND_SIZE * 100;
      return {
        label: `${low.toFixed(0)}% – ${high.toFixed(0)}% OTM`,
        avgProfit: count > 0 ? total / count : 0,
        operationsCount: count,
      };
    })
    .sort((a, b) => b.avgProfit - a.avgProfit);
}
