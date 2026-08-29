'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Wallet, Pencil, CircleDollarSign } from 'lucide-react';
import { cn, formatBRL, formatDate } from '@/lib/utils';
import { updateOperationFields } from '@/lib/supabase/queries';
import { getActiveSystem } from '@/lib/supabase/client';
import { IR_RATE } from '@/lib/calculations/finance';
import type { Operation } from '@/lib/types/database';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface PremiumsTabProps {
  operations: Operation[];
  onChanged: () => void;
}

interface ComputedRow {
  op: Operation;
  netPremium: number;
  estimated: boolean;
}

function computeNetPremium(op: Operation): { netPremium: number; estimated: boolean } {
  const hasFinalIr = op.status !== 'aberta' && op.ir_amount !== null;
  if (hasFinalIr) {
    return { netPremium: op.premium_received - (op.ir_amount ?? 0), estimated: false };
  }
  const estimatedIr = op.premium_received > 0 ? op.premium_received * IR_RATE : 0;
  return { netPremium: op.premium_received - estimatedIr, estimated: true };
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function PremiumsTab({ operations, onChanged }: PremiumsTabProps) {
  const [isMae] = useState(() => (typeof window !== 'undefined' ? getActiveSystem() === 'mae' : false));

  const groups = useMemo(() => {
    const map = new Map<string, Operation[]>();
    for (const op of operations) {
      const key = monthKey(op.opened_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(op);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, ops]) => ({
        key,
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)) - 1,
        operations: [...ops].sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()),
      }));
  }, [operations]);

  if (operations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-glass-border bg-glass px-6 py-14 text-center backdrop-blur-xl">
        <CircleDollarSign className="h-8 w-8 text-faint-foreground" />
        <p className="text-sm font-medium text-foreground">Nenhum prêmio registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <PremiumMonthGroup key={g.key} year={g.year} month={g.month} operations={g.operations} isMae={isMae} onChanged={onChanged} />
      ))}
    </div>
  );
}

function PremiumMonthGroup({
  year,
  month,
  operations,
  isMae,
  onChanged,
}: {
  year: number;
  month: number;
  operations: Operation[];
  isMae: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(true);
  const rows: ComputedRow[] = operations.map((op) => ({ op, ...computeNetPremium(op) }));
  const monthTotal = rows.reduce((sum, r) => sum + r.netPremium, 0);
  const withdrawnCount = operations.filter((o) => o.premium_withdrawn_at).length;

  return (
    <div className="rounded-xl border border-glass-border bg-glass backdrop-blur-xl transition-colors">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-sm font-bold text-foreground">
            {MONTH_NAMES[month]} de {year}
          </span>
          <span className="font-tabular text-xs font-semibold text-primary-accent">{formatBRL(monthTotal)}</span>
        </div>
        <span className="whitespace-nowrap text-xs text-faint-foreground">
          {withdrawnCount}/{operations.length} sacadas
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {rows.map((r) => (
            <PremiumRowItem key={r.op.id} row={r} isMae={isMae} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function PremiumRowItem({ row, isMae, onChanged }: { row: ComputedRow; isMae: boolean; onChanged: () => void }) {
  const { op, netPremium, estimated } = row;
  const [saving, setSaving] = useState(false);
  const [pct, setPct] = useState(op.commission_pct);
  const withdrawn = !!op.premium_withdrawn_at;
  const commissionAmount = Math.round(netPremium * (pct / 100) * 100) / 100;

  async function toggleWithdrawn() {
    setSaving(true);
    try {
      await updateOperationFields(op.id, { premium_withdrawn_at: withdrawn ? null : new Date().toISOString() });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function savePct(raw: string) {
    const parsed = Math.max(0, Math.min(100, Number(raw) || 0));
    setPct(parsed);
    try {
      await updateOperationFields(op.id, { commission_pct: parsed });
      onChanged();
    } catch {
      // Se falhar ao salvar, o valor local já foi atualizado — o usuário
      // vê o número certo na tela e pode tentar de novo saindo do campo.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-glass-border bg-white/[0.02] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold',
            op.option_type === 'PUT' ? 'bg-info/15 text-info' : 'bg-accent-muted text-accent'
          )}
        >
          {op.option_type}
        </span>
        <span className="font-semibold text-foreground">{op.asset?.ticker ?? '—'}</span>
        {op.week_label && <span className="text-faint-foreground">{op.week_label}</span>}
        <span className="text-faint-foreground">{formatDate(op.opened_at)}</span>
        {op.status === 'aberta' && (
          <span className="rounded-full bg-warning-muted px-2 py-0.5 text-[10px] font-medium text-warning">
            Aberta — valor estimado
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('font-tabular font-semibold', withdrawn ? 'text-faint-foreground' : 'text-primary-accent')}>
          {estimated && '≈ '}
          {formatBRL(netPremium)}
        </span>

        {isMae && (
          <div className="flex items-center gap-1 text-faint-foreground">
            <span>Comissão</span>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={pct}
              onBlur={(e) => savePct(e.target.value)}
              className="w-11 rounded border border-white/10 bg-transparent px-1 py-0.5 text-center font-tabular text-xs text-foreground outline-none focus:ring-1 focus:ring-primary-accent-border"
            />
            <span>%</span>
            <span className="font-tabular text-warning">−{formatBRL(commissionAmount)}</span>
          </div>
        )}

        <button
          onClick={toggleWithdrawn}
          disabled={saving}
          className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50',
            withdrawn ? 'bg-white/[0.04] text-faint-foreground' : 'bg-primary-accent/15 text-primary-accent'
          )}
        >
          <Wallet className="h-3 w-3" />
          {withdrawn ? 'Sacado' : 'Sacar'}
        </button>

        {withdrawn && (
          <button
            onClick={toggleWithdrawn}
            disabled={saving}
            title="Editar — desfazer saque"
            aria-label="Editar — desfazer saque"
            className="text-faint-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
