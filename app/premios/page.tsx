'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, TrendingUp, Wallet, Pencil } from 'lucide-react';
import { cn, formatBRL, formatDate } from '@/lib/utils';
import { IR_RATE } from '@/lib/calculations/finance';
import { listOperationsForSystem, setCommissionWithdrawn } from '@/lib/supabase/premios-cross-system';
import type { Operation } from '@/lib/types/database';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface RowCalc {
  ir: number;
  net: number;
  estimated: boolean;
}

function computeRow(op: Operation): RowCalc {
  const isClosed = op.status !== 'aberta';
  if (isClosed && op.ir_amount !== null && op.net_profit !== null) {
    return { ir: op.ir_amount, net: op.net_profit, estimated: false };
  }
  const estimatedIr = op.premium_received > 0 ? op.premium_received * IR_RATE : 0;
  return { ir: estimatedIr, net: op.premium_received - estimatedIr, estimated: true };
}

function commissionOf(op: Operation, isMae: boolean): number {
  if (!isMae) return 0;
  return computeRow(op).net * (op.commission_pct / 100);
}

function monthKeyOf(op: Operation): string {
  const raw = op.expiration || op.opened_at;
  return raw && raw.length >= 7 ? raw.slice(0, 7) : 'sem-data';
}

interface OpRow {
  op: Operation;
  system: 'diogo' | 'mae';
}

interface MonthGroup {
  monthKey: string;
  label: string;
  rows: OpRow[];
}

interface MonthTotals {
  diogoNet: number;
  maeNet: number;
  commission: number;
  combined: number;
}

function totalsOf(rows: OpRow[]): MonthTotals {
  let diogoNet = 0;
  let maeNet = 0;
  let commission = 0;
  for (const { op, system } of rows) {
    const r = computeRow(op);
    if (system === 'diogo') diogoNet += r.net;
    else {
      maeNet += r.net;
      commission += commissionOf(op, true);
    }
  }
  return { diogoNet, maeNet, commission, combined: diogoNet + commission };
}

export default function PremiosCombinadosPage() {
  const [diogoOps, setDiogoOps] = useState<Operation[] | null>(null);
  const [maeOps, setMaeOps] = useState<Operation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    return Promise.all([listOperationsForSystem('diogo'), listOperationsForSystem('mae')])
      .then(([d, m]) => {
        setDiogoOps(d);
        setMaeOps(m);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar prêmios.'));
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggleCommissionWithdrawn(op: Operation) {
    const withdrawn = !op.commission_withdrawn_at;
    setMaeOps((prev) => prev?.map((o) => (o.id === op.id ? { ...o, commission_withdrawn_at: withdrawn ? new Date().toISOString() : null } : o)) ?? null);
    try {
      await setCommissionWithdrawn(op.id, withdrawn);
    } catch {
      reload();
    }
  }

  const months = useMemo<MonthGroup[]>(() => {
    if (!diogoOps || !maeOps) return [];

    const byMonth = new Map<string, OpRow[]>();
    function place(op: Operation, system: 'diogo' | 'mae') {
      const mKey = monthKeyOf(op);
      if (!byMonth.has(mKey)) byMonth.set(mKey, []);
      byMonth.get(mKey)!.push({ op, system });
    }
    for (const op of diogoOps) place(op, 'diogo');
    for (const op of maeOps) place(op, 'mae');

    return Array.from(byMonth.entries())
      .sort((a, b) => {
        if (a[0] === 'sem-data') return 1;
        if (b[0] === 'sem-data') return -1;
        return a[0] < b[0] ? 1 : -1;
      })
      .map(([mKey, rows]) => ({
        monthKey: mKey,
        label: mKey === 'sem-data' ? 'Sem data' : `${MONTH_NAMES[Number(mKey.slice(5, 7)) - 1]} de ${mKey.slice(0, 4)}`,
        rows: [...rows].sort((a, b) => {
          const da = a.op.expiration || a.op.opened_at || '';
          const db = b.op.expiration || b.op.opened_at || '';
          return db.localeCompare(da);
        }),
      }));
  }, [diogoOps, maeOps]);

  const grandTotal = useMemo(() => {
    const allRows: OpRow[] = [
      ...(diogoOps ?? []).map((op) => ({ op, system: 'diogo' as const })),
      ...(maeOps ?? []).map((op) => ({ op, system: 'mae' as const })),
    ];
    return totalsOf(allRows);
  }, [diogoOps, maeOps]);

  const loading = diogoOps === null || maeOps === null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/escolher-sistema" className="text-faint-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15">
              <TrendingUp className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight">OptionOS</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">Prêmios — Diogo + Mãe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada operação na sua própria linha, por mês. Só controle pessoal — não altera nada em nenhum dos dois
          sistemas.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {loading && !error && <p className="mt-6 text-sm text-faint-foreground">Carregando…</p>}

        {!loading && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="overflow-x-auto rounded-xl border border-glass-border bg-glass backdrop-blur-xl">
              <table className="w-full min-w-[900px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-glass-border bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-faint-foreground">
                    <Th align="left">Semana</Th>
                    <Th align="left">Sistema / Ativo</Th>
                    <Th>Bruto</Th>
                    <Th>IR</Th>
                    <Th>Líquido</Th>
                    <Th>Comissão</Th>
                    <Th>Sacado</Th>
                    <Th>Prêmio + Comissão</Th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, i) => (
                    <MonthBlock key={month.monthKey} month={month} isFirst={i === 0} onToggleCommission={toggleCommissionWithdrawn} />
                  ))}
                  {months.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-faint-foreground">
                        Nenhuma operação registrada em nenhum dos dois sistemas ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
                {months.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-primary-accent bg-primary-accent/10 text-sm font-extrabold">
                      <Td align="left" colSpan={2}>Total geral</Td>
                      <Td>—</Td>
                      <Td>—</Td>
                      <Td><span className="text-foreground">{formatBRL(grandTotal.diogoNet + grandTotal.maeNet)}</span></Td>
                      <Td><span className="text-warning">{formatBRL(grandTotal.commission)}</span></Td>
                      <Td>—</Td>
                      <Td><span className="text-foreground">{formatBRL(grandTotal.combined)}</span></Td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p className="text-[11px] text-faint-foreground">
              * Líquido = prêmio bruto − IR, e quando é uma CALL exercida, também soma o ganho ou perda da venda da
              ação (Strike vs Preço Médio). Em operações ainda abertas, é uma estimativa (15% de IR sobre o prêmio) e
              ajusta sozinho quando a operação fechar. Comissão = líquido × % configurado na própria operação
              (normalmente 50%, editável na aba Prêmios de dentro do sistema Mãe), só existe em operações da Mãe.
              Prêmio + Comissão (nas linhas de mês/total) = líquido do Diogo + comissão da Mãe naquele período.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthBlock({
  month,
  isFirst,
  onToggleCommission,
}: {
  month: MonthGroup;
  isFirst: boolean;
  onToggleCommission: (op: Operation) => void;
}) {
  const [open, setOpen] = useState(true);
  const totals = totalsOf(month.rows);

  return (
    <>
      {!isFirst && (
        <tr aria-hidden="true">
          <td colSpan={8} className="h-4 bg-transparent p-0" />
        </tr>
      )}
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer border-y border-primary-accent-border bg-white/[0.06] text-sm font-bold hover:bg-white/[0.08]"
      >
        <Td align="left" colSpan={2}>
          <span className="flex items-center gap-1.5 py-1">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {month.label}
          </span>
        </Td>
        <Td>—</Td>
        <Td>—</Td>
        <Td><span className="text-foreground">{formatBRL(totals.diogoNet + totals.maeNet)}</span></Td>
        <Td><span className="text-warning">{formatBRL(totals.commission)}</span></Td>
        <Td>—</Td>
        <Td><span className="text-foreground">{formatBRL(totals.combined)}</span></Td>
      </tr>
      {open && month.rows.map((row) => <OpRowItem key={row.op.id} row={row} onToggleCommission={onToggleCommission} />)}
    </>
  );
}

function OpRowItem({ row, onToggleCommission }: { row: OpRow; onToggleCommission: (op: Operation) => void }) {
  const { op, system } = row;
  const isMae = system === 'mae';
  const r = computeRow(op);
  const commission = commissionOf(op, isMae);
  const withdrawn = !!op.commission_withdrawn_at;

  return (
    <tr className="border-b border-glass-border/60">
      <Td align="left">
        <span className="pl-5 text-muted-foreground">
          {op.week_label ?? '—'} <span className="text-faint-foreground">· {formatDate(op.expiration)}</span>
        </span>
      </Td>
      <Td align="left">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', isMae ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent')}>
          {isMae ? 'Mãe' : 'Diogo'}
        </span>
        <span className="ml-2 font-semibold text-foreground">{op.asset?.ticker ?? '—'}</span>
        <span className="ml-1 text-faint-foreground">({op.option_type})</span>
      </Td>
      <Td>
        <span className={isMae ? 'text-info' : 'text-accent'}>
          {formatBRL(op.premium_received)}
          {r.estimated && '*'}
        </span>
      </Td>
      <Td><span className="text-danger">{formatBRL(r.ir)}</span></Td>
      <Td><span className={isMae ? 'text-info' : 'text-accent'}>{formatBRL(r.net)}</span></Td>
      <Td>
        {isMae ? (
          <span className={cn('font-semibold', withdrawn ? 'text-faint-foreground' : 'text-warning')}>{formatBRL(commission)}</span>
        ) : (
          '—'
        )}
      </Td>
      <Td>
        {isMae ? (
          <button
            onClick={() => onToggleCommission(op)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              withdrawn ? 'bg-white/[0.04] text-faint-foreground' : 'bg-warning-muted text-warning'
            )}
          >
            {withdrawn ? <Pencil className="h-2.5 w-2.5" /> : <Wallet className="h-2.5 w-2.5" />}
            {withdrawn ? 'Sacado' : 'Sacar'}
          </button>
        ) : (
          '—'
        )}
      </Td>
      <Td>—</Td>
    </tr>
  );
}

function Th({ children, align = 'center' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return <th className={cn('px-2.5 py-2', align === 'left' ? 'text-left' : 'text-center')}>{children}</th>;
}

function Td({
  children,
  align = 'center',
  colSpan,
}: {
  children: React.ReactNode;
  align?: 'left' | 'center';
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn('px-2.5 py-1.5 font-tabular', align === 'left' ? 'text-left' : 'text-center')}>
      {children}
    </td>
  );
}
