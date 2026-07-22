'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatBRL, formatDate } from '@/lib/utils';
import type { Operation, CommissionEntry, Withdrawal } from '@/lib/types/database';

type KpiDetailKind = 'profit' | 'premiums' | 'commissions' | 'withdrawals' | null;

interface KpiDetailDialogProps {
  kind: KpiDetailKind;
  onClose: () => void;
  operations: Operation[];
  commissionEntries: CommissionEntry[];
  withdrawals: Withdrawal[];
}

const TITLES: Record<Exclude<KpiDetailKind, null>, string> = {
  profit: 'Lucro Total (líquido) — de onde veio',
  premiums: 'Prêmios Recebidos (bruto) — de onde veio',
  commissions: 'Comissões Recebidas — lançamentos',
  withdrawals: 'Total Sacado — lançamentos',
};

export function KpiDetailDialog({ kind, onClose, operations, commissionEntries, withdrawals }: KpiDetailDialogProps) {
  if (!kind) return null;

  const closedOps = operations.filter((o) => o.status !== 'aberta' && o.net_profit !== null);

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITLES[kind]}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {kind === 'profit' &&
            (closedOps.length === 0 ? (
              <Empty />
            ) : (
              closedOps
                .slice()
                .sort((a, b) => new Date(b.closed_at ?? 0).getTime() - new Date(a.closed_at ?? 0).getTime())
                .map((o) => (
                  <Row key={o.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{o.option_type}</Badge>
                      <span className="font-tabular text-xs font-bold text-foreground">{o.asset?.ticker ?? '—'}</span>
                      <span className="text-[11px] text-faint-foreground">{o.closed_at ? formatDate(o.closed_at) : '—'}</span>
                    </div>
                    <span className={`font-tabular text-xs font-bold ${(o.net_profit ?? 0) >= 0 ? 'text-accent' : 'text-danger'}`}>
                      {formatBRL(o.net_profit)}
                    </span>
                  </Row>
                ))
            ))}

          {kind === 'premiums' &&
            (operations.length === 0 ? (
              <Empty />
            ) : (
              operations
                .slice()
                .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
                .map((o) => (
                  <Row key={o.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{o.option_type}</Badge>
                      <span className="font-tabular text-xs font-bold text-foreground">{o.asset?.ticker ?? '—'}</span>
                      <span className="text-[11px] text-faint-foreground">{formatDate(o.opened_at)}</span>
                    </div>
                    <span className="font-tabular text-xs font-bold text-accent">{formatBRL(o.premium_received)}</span>
                  </Row>
                ))
            ))}

          {kind === 'commissions' &&
            (commissionEntries.length === 0 ? (
              <Empty />
            ) : (
              commissionEntries
                .slice()
                .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
                .map((c) => (
                  <Row key={c.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-faint-foreground">{formatDate(c.received_at)}</span>
                      {c.notes && <span className="text-[11px] text-faint-foreground">— {c.notes}</span>}
                    </div>
                    <span className="font-tabular text-xs font-bold text-accent">{formatBRL(c.amount)}</span>
                  </Row>
                ))
            ))}

          {kind === 'withdrawals' &&
            (withdrawals.length === 0 ? (
              <Empty />
            ) : (
              withdrawals
                .slice()
                .sort((a, b) => new Date(b.withdrawn_at).getTime() - new Date(a.withdrawn_at).getTime())
                .map((w) => (
                  <Row key={w.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-faint-foreground">{formatDate(w.withdrawn_at)}</span>
                      {w.operation_id && <span className="text-[11px] text-faint-foreground">— vinculado a operação</span>}
                      {w.notes && <span className="text-[11px] text-faint-foreground">— {w.notes}</span>}
                    </div>
                    <span className="font-tabular text-xs font-bold text-warning">{formatBRL(w.amount)}</span>
                  </Row>
                ))
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2">{children}</div>;
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento ainda.</p>;
}
