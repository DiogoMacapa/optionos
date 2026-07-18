'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Operation, EquitySnapshot, Holder, StrategySettings, Withdrawal } from '@/lib/types/database';

export interface DashboardData {
  operations: Operation[];
  equityHistory: EquitySnapshot[];
  holders: Holder[];
  strategySettings: StrategySettings | null;
  withdrawals: Withdrawal[];
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquitySnapshot[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [opsRes, equityRes, holdersRes, settingsRes, withdrawalsRes] = await Promise.all([
        supabase.from('operations').select('*, asset:assets(*), holder:holders(*)').order('opened_at', { ascending: false }),
        supabase.from('equity_snapshots').select('*').order('recorded_at', { ascending: true }),
        supabase.from('holders').select('*').eq('active', true).order('is_self', { ascending: false }),
        supabase.from('strategy_settings').select('*').limit(1).single(),
        supabase.from('withdrawals').select('*'),
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

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { operations, equityHistory, holders, strategySettings, withdrawals, loading, error };
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
export function computeKpis(operations: Operation[], strategySettings: StrategySettings | null, withdrawals: Withdrawal[] = []) {
  const openOps = operations.filter((o) => o.status === 'aberta');
  const closedOps = operations.filter((o) => o.status !== 'aberta' && o.net_profit !== null);

  // KPIs informativos (Lucro Total, Prêmios Recebidos) somam TUDO, incluindo
  // operações marcadas como "histórico" — são sobre a atividade real do
  // usuário, não sobre o cálculo de patrimônio.
  const totalPremiums = operations.reduce((sum, o) => sum + (o.premium_received || 0), 0);
  const totalProfit = operations.reduce((sum, o) => sum + (o.net_profit || 0), 0);
  const totalIrPaid = operations.reduce((sum, o) => sum + (o.ir_amount && (o.gross_result ?? 0) > 0 ? o.ir_amount : 0), 0);
  const committedCapital = openOps.reduce((sum, o) => sum + (o.committed_capital || 0), 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

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
  const cashToday = initialEquity !== null ? initialEquity + equityImpactingProfit - totalWithdrawn : null;

  const freeCash = cashToday !== null ? Math.max(0, cashToday - committedCapital) : null;
  const currentEquity = cashToday !== null ? cashToday + emergencyReserve : null;

  return {
    currentEquity,
    initialEquity,
    totalProfit,
    totalPremiums,
    totalIrPaid,
    totalWithdrawn,
    freeCash,
    committedCapital,
    emergencyReserve,
    openOperationsCount: openOps.length,
    successRatePct: successRate,
    exerciseRatePct: exerciseRate,
  };
}
