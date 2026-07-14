'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Operation, EquitySnapshot, Holder } from '@/lib/types/database';

export interface DashboardData {
  operations: Operation[];
  equityHistory: EquitySnapshot[];
  holders: Holder[];
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquitySnapshot[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [opsRes, equityRes, holdersRes] = await Promise.all([
        supabase.from('operations').select('*, asset:assets(*), holder:holders(*)').order('opened_at', { ascending: false }),
        supabase.from('equity_snapshots').select('*').order('recorded_at', { ascending: true }),
        supabase.from('holders').select('*').eq('active', true).order('is_self', { ascending: false }),
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

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { operations, equityHistory, holders, loading, error };
}

// ------------------------------------------------------------
// Filtra operações e histórico de patrimônio por titular.
// holderId === null significa "todos" (soma de todos os titulares).
// ------------------------------------------------------------
export function filterByHolder(
  operations: Operation[],
  equityHistory: EquitySnapshot[],
  holderId: string | null
): { operations: Operation[]; equityHistory: EquitySnapshot[] } {
  if (holderId === null) {
    // "Todos": soma o patrimônio por data entre titulares.
    const byDate = new Map<string, EquitySnapshot>();
    for (const snap of equityHistory) {
      const existing = byDate.get(snap.recorded_at);
      if (!existing) {
        byDate.set(snap.recorded_at, { ...snap });
      } else {
        byDate.set(snap.recorded_at, {
          ...existing,
          total_equity: existing.total_equity + snap.total_equity,
          free_cash: existing.free_cash + snap.free_cash,
          committed_capital: existing.committed_capital + snap.committed_capital,
          cumulative_premiums: existing.cumulative_premiums + snap.cumulative_premiums,
          cumulative_profit: existing.cumulative_profit + snap.cumulative_profit,
        });
      }
    }
    const merged = Array.from(byDate.values()).sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    return { operations, equityHistory: merged };
  }
  return {
    operations: operations.filter((o) => o.holder_id === holderId),
    equityHistory: equityHistory.filter((e) => e.holder_id === holderId),
  };
}

// ------------------------------------------------------------
// Cálculos derivados a partir das operações (KPIs do dashboard)
// ------------------------------------------------------------
export function computeKpis(operations: Operation[], equityHistory: EquitySnapshot[]) {
  const openOps = operations.filter((o) => o.status === 'aberta');
  const closedOps = operations.filter((o) => o.status !== 'aberta');

  const totalPremiums = operations.reduce((sum, o) => sum + (o.premium_received || 0), 0);
  const totalProfit = operations.reduce((sum, o) => sum + (o.net_profit || 0), 0);
  const committedCapital = openOps.reduce((sum, o) => sum + (o.committed_capital || 0), 0);

  const successCount = closedOps.filter((o) => (o.net_profit || 0) > 0).length;
  const successRate = closedOps.length > 0 ? (successCount / closedOps.length) * 100 : 0;

  const latest = equityHistory[equityHistory.length - 1];
  const first = equityHistory[0];

  return {
    currentEquity: latest?.total_equity ?? null,
    initialEquity: first?.total_equity ?? null,
    totalProfit,
    totalPremiums,
    freeCash: latest?.free_cash ?? null,
    committedCapital,
    openOperationsCount: openOps.length,
    successRatePct: successRate,
  };
}
