'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PutOperationsTable } from '@/components/operations/put-operations-table';
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
  onChanged: () => void;
  onClose: (op: Operation) => void;
  defaultOpen?: boolean;
}

export function MonthExpirationGroup({ year, month, operations, onChanged, onClose, defaultOpen = true }: MonthExpirationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const openCount = operations.filter((o) => o.status === 'aberta').length;

  return (
    <div className="rounded-xl border border-border bg-surface">
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
      {open && (
        <div className="px-3 pb-3">
          <PutOperationsTable operations={operations} onChanged={onChanged} onClose={onClose} />
        </div>
      )}
    </div>
  );
}
