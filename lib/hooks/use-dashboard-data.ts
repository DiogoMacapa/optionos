'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Operation, EquitySnapshot, Holder, StrategySettings } from '@/lib/types/database';

export interface DashboardData {
  operations: Operation[];
  equityHistory: EquitySnapshot[];
  holders: Holder[];
  strategySettings: StrategySettings | null;
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquitySnapshot[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [opsRes, equityRes, holdersRes, settingsRes] = await Promise.all([
        supabase.from('operations').select('*, asset:assets(*), holder:holders(*)').order('opened_at', { ascending: false }),
        supabase.from('equity_snapshots').select('*').order('recorded_at', { ascending: true }),
        supabase.from('holders').select('*').eq('active', true).order('is_self', { ascending: false }),
        supabase.from('strategy_settings').select('*').limit(1).single(),
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

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { operations, equityHistory, holders, strategySettings, loading, error };
}

// ------------------------------------------------------------
// Filtra operações por titular. holderId === null significa "todos".
// ------------------------------------------------------------
export function filterByHolder(operations: Operation[], holderId: string | null): { operations: Operation[] } {
  if (holderId === null) return { operations };
  return { operations: operations.filter((o) => o.holder_id === holderId) };
}

// ------------------------------------------------------------
// Cálculos derivados a partir das operações (KPIs do dashboard)
//
// IMPORTANTE: Caixa Livre, Capital Comprometido e Patrimônio Atual
// NÃO usam mais o snapshot manual de equity_snapshots (que ficava
// desatualizado, gerando números falsos tipo "caixa livre" quando na
// verdade 100% do caixa estava comprometido). Agora derivam sempre
// de strategy_settings.available_cash — o único número que o usuário
// atualiza manualmente — mais o que está de fato comprometido nas
// operações abertas neste momento.
// ------------------------------------------------------------
export function computeKpis(operations: Operation[], strategySettings: StrategySettings | null) {
  const openOps = operations.filter((o) => o.status === 'aberta');
  const closedOps = operations.filter((o) => o.status !== 'aberta' && o.net_profit !== null);

  const totalPremiums = operations.reduce((sum, o) => sum + (o.premium_received || 0), 0);
  const totalProfit = operations.reduce((sum, o) => sum + (o.net_profit || 0), 0);
  const totalIrPaid = operations.reduce((sum, o) => sum + (o.ir_amount && (o.gross_result ?? 0) > 0 ? o.ir_amount : 0), 0);
  const committedCapital = openOps.reduce((sum, o) => sum + (o.committed_capital || 0), 0);

  const successCount = closedOps.filter((o) => (o.net_profit || 0) > 0).length;
  const successRate = closedOps.length > 0 ? (successCount / closedOps.length) * 100 : 0;

  const exercisedCount = closedOps.filter((o) => o.exercised_label === 'Sim').length;
  const exerciseRate = closedOps.length > 0 ? (exercisedCount / closedOps.length) * 100 : 0;

  const availableCash = strategySettings?.available_cash ?? null;
  const emergencyReserve = strategySettings?.emergency_reserve ?? 0;

  // Caixa livre = o que você informou como disponível, menos o que já está
  // comprometido em operações abertas neste momento (nunca pode ficar negativo
  // na exibição — se der negativo é sinal de que available_cash está desatualizado).
  const freeCash = availableCash !== null ? Math.max(0, availableCash - committedCapital) : null;

  // Patrimônio atual = caixa disponível informado + reserva de emergência
  // (que soma ao patrimônio total, mas não é operável) + lucro acumulado.
  // Isso substitui o "total_equity" do snapshot manual desatualizado.
  const currentEquity = availableCash !== null ? availableCash + emergencyReserve : null;

  return {
    currentEquity,
    initialEquity: null as number | null, // patrimônio inicial ainda depende de snapshot histórico manual
    totalProfit,
    totalPremiums,
    totalIrPaid,
    freeCash,
    committedCapital,
    emergencyReserve,
    openOperationsCount: openOps.length,
    successRatePct: successRate,
    exerciseRatePct: exerciseRate,
  };
}
