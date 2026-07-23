'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Operation } from '@/lib/types/database';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface MonthGroup {
  year: number;
  month: number;
  operations: Operation[];
}

export function groupByExpirationMonth(ops: Operation[]): MonthGroup[] {
  const groups: Record<string, MonthGroup> = {};
  for (const op of ops) {
    const d = new Date(op.expiration + 'T00:00:00');
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groups[key]) groups[key] = { year: d.getFullYear(), month: d.getMonth(), operations: [] };
    groups[key].operations.push(op);
  }
  return Object.values(groups).sort((a, b) => a.year - b.year || a.month - b.month);
}

interface MonthExpirationGroupProps {
  year: number;
  month: number;
  operations: Operation[];
  defaultOpen?: boolean;
  children: React.ReactNode; // a tabela (PutOperationsTable ou CallOperationsTable) já montada
}

import { formatBRL, cn } from '@/lib/utils';

export function MonthExpirationGroup({ year, month, operations, defaultOpen = true, children }: MonthExpirationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const openCount = operations.filter((o) => o.status === 'aberta').length;
  const closedNetProfit = operations
    .filter((o) => o.status !== 'aberta' && o.net_profit !== null)
    .reduce((sum, o) => sum + (o.net_profit ?? 0), 0);
  const hasClosedOps = operations.some((o) => o.status !== 'aberta' && o.net_profit !== null);

  return (
    <div className={cn('rounded-xl border bg-surface transition-colors', open ? 'border-accent/25' : 'border-border')}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-sm font-bold text-foreground">
            {MONTH_NAMES[month]} de {year}
          </span>
          {hasClosedOps && (
            <span className={cn('font-tabular text-xs font-semibold', closedNetProfit >= 0 ? 'text-accent' : 'text-danger')}>
              {closedNetProfit >= 0 ? '+' : ''}
              {formatBRL(closedNetProfit)}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {openCount > 0 && (
            <Badge variant="success">
              {openCount} aberta{openCount > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge>{operations.length} total</Badge>
        </div>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
