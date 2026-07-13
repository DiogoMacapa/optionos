'use client';

import { cn, formatBRL, formatDate, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Operation } from '@/lib/types/database';

interface OperationRowProps {
  operation: Operation;
  daysRemaining: number;
  onClose: () => void;
}

const STATUS_VARIANT: Record<Operation['status'], 'default' | 'success' | 'warning' | 'danger'> = {
  aberta: 'default',
  encerrada: 'success',
  rolada: 'warning',
  exercida: 'danger',
};

export function OperationRow({ operation, daysRemaining, onClose }: OperationRowProps) {
  const isOpen = operation.status === 'aberta';
  const resultColor =
    operation.net_profit === null ? 'text-muted-foreground' : operation.net_profit >= 0 ? 'text-accent' : 'text-danger';
  const showHolder = operation.holder && !operation.holder.is_self;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-tabular text-sm font-semibold text-foreground">{operation.asset?.ticker ?? '—'}</span>
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium',
              operation.option_type === 'PUT'
                ? 'border-info/25 bg-info/10 text-info'
                : 'border-accent/25 bg-accent-muted text-accent'
            )}
          >
            {operation.option_type}
          </span>
          <Badge variant={STATUS_VARIANT[operation.status]}>{operation.status}</Badge>
          {showHolder && (
            <span className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {operation.holder!.name}
            </span>
          )}
          {isOpen && (
            <span className="text-xs text-faint-foreground">
              {daysRemaining <= 0 ? 'vence hoje' : `${daysRemaining}d restantes`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-tabular text-xs text-muted-foreground">
          <span>
            Strike <span className="text-foreground">{formatNumber(operation.strike)}</span>
          </span>
          <span>
            Δ <span className="text-foreground">{formatNumber(operation.delta_at_open, 2)}</span>
          </span>
          <span>
            Qtd <span className="text-foreground">{operation.quantity}</span>
          </span>
          <span>
            Prêmio <span className="text-accent">{formatBRL(operation.premium_received)}</span>
          </span>
          <span>
            Capital <span className="text-foreground">{formatBRL(operation.committed_capital)}</span>
          </span>
          {operation.ir_amount !== null && (
            <span>
              IR <span className="text-danger">{formatBRL(operation.ir_amount)}</span>
            </span>
          )}
          {operation.efficiency_pct !== null && operation.efficiency_pct !== undefined && (
            <span>
              Eficiência <span className="text-foreground">{formatNumber(operation.efficiency_pct, 1)}%</span>
            </span>
          )}
          {showHolder && operation.commission_amount > 0 && (
            <span>
              Comissão <span className="text-warning">{formatBRL(operation.commission_amount)}</span>
            </span>
          )}
          <span>Vence {formatDate(operation.expiration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {operation.net_profit !== null && (
          <div className="text-right">
            <p className="text-[10px] text-faint-foreground">
              {showHolder ? 'Líquido p/ titular' : 'Resultado líquido'}
            </p>
            <p className={cn('font-tabular text-sm font-semibold', resultColor)}>
              {formatBRL(showHolder ? operation.net_profit - operation.commission_amount : operation.net_profit)}
            </p>
          </div>
        )}
        {isOpen && (
          <Button size="sm" variant="secondary" onClick={onClose}>
            Encerrar
          </Button>
        )}
      </div>
    </div>
  );
}
