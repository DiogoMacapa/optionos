'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Operation, EquitySnapshot } from '@/lib/types/database';

export interface DashboardData {
  operations: Operation[];
  equityHistory: EquitySnapshot[];
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquitySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [opsRes, equityRes] = await Promise.all([
        supabase.from('operations').select('*, asset:assets(*)').order('opened_at', { ascending: false }),
        supabase.from('equity_snapshots').select('*').order('recorded_at', { ascending: true }),
      ]);

      if (cancelled) return;

      if (opsRes.error) {
        setError(opsRes.error.message);
      } else {
        setOperations((opsRes.data ?? []) as Operation[]);
      }

      if (!equityRes.error) {
        setEquityHistory((equityRes.data ?? []) as EquitySnapshot[]);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { operations, equityHistory, loading, error };
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
