'use client';

import { useEffect, useState } from 'react';
import { getActiveSystem, getClientFor } from '@/lib/supabase/client';
import { computeOperationNet, computeOperationCommission } from '@/lib/calculations/finance';
import type { Operation } from '@/lib/types/database';

interface PartialOperation {
  status: string;
  ir_amount: number | null;
  net_profit: number | null;
  premium_received: number;
  commission_pct: number;
  commission_withdrawn_at: string | null;
}

export function useTotalPremiosComissao(ownOperations: Operation[]): {
  total: number;
  totalSacado: number;
  loading: boolean;
} {
  const isMae = typeof window !== 'undefined' && getActiveSystem() === 'mae';
  const [crossOps, setCrossOps] = useState<PartialOperation[]>([]);
  const [loading, setLoading] = useState(!isMae);

  useEffect(() => {
    if (isMae) return;

    let cancelled = false;

    getClientFor('mae')
      .from('operations')
      .select('status, ir_amount, net_profit, premium_received, commission_pct, commission_withdrawn_at')
      .then(({ data, error }: { data: PartialOperation[] | null; error: unknown }) => {
        if (cancelled) return;
        if (!error && data) setCrossOps(data);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownNet = ownOperations.reduce((sum, op) => sum + computeOperationNet(op).net, 0);
  const ownCommission = ownOperations.reduce((sum, op) => sum + computeOperationCommission(op), 0);
  const crossCommission = crossOps.reduce((sum, op) => sum + computeOperationCommission(op), 0);

  const ownNetSacado = ownOperations
    .filter((op) => op.premium_withdrawn_at)
    .reduce((sum, op) => sum + computeOperationNet(op).net, 0);
  const ownCommissionSacado = ownOperations
    .filter((op) => op.commission_withdrawn_at)
    .reduce((sum, op) => sum + computeOperationCommission(op), 0);
  const crossCommissionSacado = crossOps
    .filter((op) => op.commission_withdrawn_at)
    .reduce((sum, op) => sum + computeOperationCommission(op), 0);

  const total = isMae ? ownNet - ownCommission : ownNet + crossCommission;
  const totalSacado = isMae ? ownNetSacado - ownCommissionSacado : ownNetSacado + crossCommissionSacado;

  return { total, totalSacado, loading };
}
