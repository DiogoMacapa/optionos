'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { OperationRow } from '@/components/operations/operation-row';
import { daysBetween } from '@/lib/calculations/finance';
import type { Operation } from '@/lib/types/database';

interface ExpirationGroupProps {
  expiration: string;
  operations: Operation[];
  onClose: (op: Operation) => void;
  defaultOpen?: boolean;
}

function formatExpirationLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function ExpirationGroup({ expiration, operations, onClose, defaultOpen = true }: ExpirationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const openCount = operations.filter((o) => o.status === 'aberta').length;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-1 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-sm font-bold capitalize text-foreground">Vence em {formatExpirationLabel(expiration)}</span>
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
        <div className="flex flex-col gap-2 pb-2 pt-1">
          {operations.map((op) => (
            <OperationRow key={op.id} operation={op} daysRemaining={daysBetween(new Date(), op.expiration)} onClose={() => onClose(op)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function groupByExpiration(ops: Operation[]): [string, Operation[]][] {
  const groups: Record<string, Operation[]> = {};
  for (const op of ops) {
    const key = op.expiration;
    if (!groups[key]) groups[key] = [];
    groups[key].push(op);
  }
  return Object.entries(groups).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
}
