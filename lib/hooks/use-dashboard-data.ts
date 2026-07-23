'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Operation, EquitySnapshot, Holder, StrategySettings, Withdrawal, CommissionEntry } from '@/lib/types/database';

export interface DashboardData {
  operations: Operation[];
  equityHistory: EquitySnapshot[];
  holders: Holder[];
  strategySettings: StrategySettings | null;
  withdrawals: Withdrawal[];
  commissionEntries: CommissionEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardData(): DashboardData {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquitySnapshot[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [commissionEntries, setCommissionEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [opsRes, equityRes, holdersRes, settingsRes, withdrawalsRes, commissionRes] = await Promise.all([
        supabase.from('operations').select('*, asset:assets(*), holder:holders(*)').order('opened_at', { ascending: false }),
        supabase.from('equity_snapshots').select('*').order('recorded_at', { ascending: true }),
        supabase.from('holders').select('*').eq('active', true).order('is_self', { ascending: false }),
        supabase.from('strategy_settings').select('*').limit(1).single(),
        supabase.from('withdrawals').select('*'),
        supabase.from('commission_entries').select('*').order('received_at', { ascending: true }),
      ]);

      if (cancelled) return;

      if (opsRes.error) {
        setError(opsRes.error.message);
      } else {
        setOperations((opsRes.data ?? []) as unknown as Operation[]);
      }

      if (!equityRes.error) {
        setEquityHistory((equityRes.data ?? []) as EquitySnapshot[]);
      }

      if (!holdersRes.error) {
        setHolders(holdersRes.data ?? []);
      }

      if (!settingsRes.error) {
        setStrategySettings(settingsRes.data as StrategySettings);
      }

      if (!withdrawalsRes.error) {
        setWithdrawals((withdrawalsRes.data ?? []) as Withdrawal[]);
      }

      if (!commissionRes.error) {
        setCommissionEntries((commissionRes.data ?? []) as CommissionEntry[]);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refetchCounter]);

  return { operations, equityHistory, holders, strategySettings, withdrawals, commissionEntries, loading, error, refetch };
}

// ------------------------------------------------------------
// Filtra operações (e saques) por titular. holderId === null significa "todos".
// ------------------------------------------------------------
export function filterByHolder(
  operations: Operation[],
  holderId: string | null,
  withdrawals: Withdrawal[] = []
): { operations: Operation[]; withdrawals: Withdrawal[] } {
  if (holderId === null) return { operations, withdrawals };
  return {
    operations: operations.filter((o) => o.holder_id === holderId),
    withdrawals: withdrawals.filter((w) => w.holder_id === holderId),
  };
}

// ------------------------------------------------------------
// Cálculos derivados a partir das operações (KPIs do dashboard)
//
// NOVO MODELO (automático, sem atualização manual semanal):
//
//   Caixa disponível hoje = Patrimônio Inicial
//                          + soma do lucro líquido de operações FECHADAS
//                          − soma dos saques registrados
//
//   Capital Comprometido = soma do capital das operações ABERTAS
//
//   Caixa Livre = Caixa disponível hoje − Capital Comprometido
//
//   Patrimônio Atual = Caixa disponível hoje + Reserva de Emergência
//                     (a reserva soma ao patrimônio total, mas não é
//                     operável — nunca entra no cálculo de cobertura)
//
// O usuário informa Patrimônio Inicial (initial_equity) UMA VEZ, antes
// da primeira operação no sistema, e marca saques por operação
// específica (withdrawals.operation_id) — o resto é automático.
// ------------------------------------------------------------
export function computeKpis(
  operations: Operation[],
  strategySettings: StrategySettings | null,
  withdrawals: Withdrawal[] = [],
  commissionEntries: CommissionEntry[] = []
) {
  const openOps = operations.filter((o) => o.status === 'aberta');
  const closedOps = operations.filter((o) => o.status !== 'aberta' && o.net_profit !== null);

  // KPIs informativos (Lucro Total, Prêmios Recebidos) somam TUDO, incluindo
  // operações marcadas como "histórico" — são sobre a atividade real do
  // usuário, não sobre o cálculo de patrimônio.
  const totalPremiums = operations.reduce((sum, o) => sum + (o.premium_received || 0), 0);
  const totalProfit = operations.reduce((sum, o) => sum + (o.net_profit || 0), 0);
  const totalIrPaid = operations.reduce((sum, o) => sum + (o.ir_amount && (o.gross_result ?? 0) > 0 ? o.ir_amount : 0), 0);
  // Capital Comprometido = Garantia real (Strike × Qnt) das PUTs abertas —
  // não usa o campo 'Caixa' (committed_capital), que é digitado manualmente
  // e pode ficar desatualizado. CALL não soma nada aqui: a garantia de uma
  // Covered Call já são as ações que o usuário possui, não caixa novo.
  const committedCapital = openOps
    .filter((o) => o.option_type === 'PUT')
    .reduce((sum, o) => sum + o.strike * o.quantity, 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalCommissions = commissionEntries.reduce((sum, c) => sum + c.amount, 0);

  const successCount = closedOps.filter((o) => (o.net_profit || 0) > 0).length;
  const successRate = closedOps.length > 0 ? (successCount / closedOps.length) * 100 : 0;

  const exercisedCount = closedOps.filter((o) => o.exercised_label === 'Sim').length;
  const exerciseRate = closedOps.length > 0 ? (exercisedCount / closedOps.length) * 100 : 0;

  const initialEquity = strategySettings?.initial_equity ?? null;
  const emergencyReserve = strategySettings?.emergency_reserve ?? 0;

  // Só operações com counts_toward_equity=true somam ao patrimônio — evita
  // contagem duplicada quando o Patrimônio Inicial já reflete o resultado
  // de um histórico importado (ex: operações antigas de antes do sistema).
  const equityImpactingProfit = closedOps
    .filter((o) => o.counts_toward_equity)
    .reduce((sum, o) => sum + (o.net_profit || 0), 0);

  // Caixa disponível hoje: automático, sem depender de atualização manual.
  // Comissões entram como caixa recebido, somando junto do lucro das operações.
  const cashToday = initialEquity !== null ? initialEquity + equityImpactingProfit + totalCommissions - totalWithdrawn : null;

  const freeCash = cashToday !== null ? Math.max(0, cashToday - committedCapital) : null;
  const currentEquity = cashToday !== null ? cashToday + emergencyReserve : null;

  return {
    currentEquity,
    initialEquity,
    totalProfit,
    equityImpactingProfit,
    totalPremiums,
    totalIrPaid,
    totalWithdrawn,
    totalCommissions,
    freeCash,
    committedCapital,
    emergencyReserve,
    openOperationsCount: openOps.length,
    successRatePct: successRate,
    exerciseRatePct: exerciseRate,
  };
}

// ------------------------------------------------------------
// Série histórica real do patrimônio: começa no Patrimônio Inicial e
// evolui cronologicamente somando o lucro líquido de cada operação
// fechada, comissões recebidas, e subtraindo saques na data em que
// ocorreram. Reaproveitada pelo Dashboard (Evolução Patrimonial) e
// pela tela de Objetivos (gráfico de projeção da meta).
//
// Sempre inclui um ponto inicial fixo (Patrimônio Inicial), um dia
// antes do primeiro evento real (ou hoje, se não houver nenhum) —
// sem isso, com poucos eventos o gráfico ficava com 1 ponto só e
// não desenhava linha nenhuma (LineChartCard exige 2+ pontos).
// ------------------------------------------------------------
export function computeEquitySeries(
  initialEquity: number | null,
  operations: Operation[],
  withdrawals: Withdrawal[],
  commissionEntries: CommissionEntry[]
): { date: string; value: number }[] {
  if (initialEquity === null) return [];

  const closedChronological = [...operations]
    .filter((o) => o.status !== 'aberta' && o.net_profit !== null && o.closed_at)
    .sort((a, b) => new Date(a.closed_at as string).getTime() - new Date(b.closed_at as string).getTime());

  type Event = { date: string; delta: number };
  const events: Event[] = [
    ...closedChronological.map((o) => ({ date: (o.closed_at as string).slice(0, 10), delta: o.net_profit ?? 0 })),
    ...withdrawals.map((w) => ({ date: w.withdrawn_at, delta: -w.amount })),
    ...commissionEntries.map((c) => ({ date: c.received_at, delta: c.amount })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const firstEventDate = events.length > 0 ? new Date(events[0].date) : new Date();
  const initialPointDate = new Date(firstEventDate);
  initialPointDate.setDate(initialPointDate.getDate() - 1);

  const series: { date: string; value: number }[] = [{ date: initialPointDate.toISOString().slice(0, 10), value: initialEquity }];

  return events.reduce<{ date: string; value: number }[]>((acc, ev) => {
    const previous = acc[acc.length - 1].value;
    acc.push({ date: ev.date, value: previous + ev.delta });
    return acc;
  }, series);
}
