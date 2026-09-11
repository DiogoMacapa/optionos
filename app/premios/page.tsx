'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, TrendingUp, Wallet, Pencil } from 'lucide-react';
import { cn, formatBRL, formatDate } from '@/lib/utils';
import { computeOperationNet, computeOperationCommission } from '@/lib/calculations/finance';
import { listOperationsForSystem, setCommissionWithdrawn } from '@/lib/supabase/premios-cross-system';
import type { Operation } from '@/lib/types/database';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface Agg {
  gross: number;
  ir: number;
  net: number;
  estimated: boolean;
}

interface RowCalc {
  ir: number;
  net: number;
  estimated: boolean;
}

function computeRow(op: Operation): RowCalc {
  return computeOperationNet(op);
}

function aggregate(ops: Operation[]): Agg {
  let gross = 0;
  let ir = 0;
  let net = 0;
  let estimated = false;
  for (const op of ops) {
    const r = computeRow(op);
    gross += op.premium_received;
    ir += r.ir;
    net += r.net;
    if (r.estimated) estimated = true;
  }
  return { gross, ir, net, estimated };
}

function commissionOf(op: Operation): number {
  return computeOperationCommission(op);
}

function monthKeyOf(op: Operation): string {
  const raw = op.expiration || op.opened_at;
  return raw && raw.length >= 7 ? raw.slice(0, 7) : 'sem-data';
}

interface PairRow {
  key: string;
  weekLabel: string;
  ticker: string;
  optionType: string;
  diogoOps: Operation[];
  maeOps: Operation[];
}

interface MonthGroup {
  monthKey: string;
  label: string;
  rows: PairRow[];
}

interface Totals {
  diogoNet: number;
  maeNet: number;
  commission: number;
  total: number;
}

function totalsOfPairs(rows: PairRow[]): Totals {
  let diogoNet = 0;
  let maeNet = 0;
  let commission = 0;
  for (const row of rows) {
    diogoNet += aggregate(row.diogoOps).net;
    maeNet += aggregate(row.maeOps).net;
    commission += row.maeOps.reduce((sum, op) => sum + commissionOf(op), 0);
  }
  return { diogoNet, maeNet, commission, total: diogoNet + commission };
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

  async function toggleCommissionWithdrawn(maeOpsInRow: Operation[]) {
    if (maeOpsInRow.length === 0) return;
    const withdrawn = maeOpsInRow.every((op) => !!op.commission_withdrawn_at);
    const nextValue = withdrawn ? null : new Date().toISOString();
    const ids = new Set(maeOpsInRow.map((op) => op.id));
    setMaeOps( (prev) => prev?.map((o) => (ids.has(o.id) ? { ...o, commission_withdrawn_at: nextValue, premium_withdrawn_at: nextValue } : o)) ?? null );
    try {
      await Promise.all(maeOpsInRow.map((op) => setCommissionWithdrawn(op.id, !withdrawn)));
    } catch {
      reload();
    }
  }

  const months = useMemo<MonthGroup[]>(() => {
    if (!diogoOps || !maeOps) return [];

    const byMonth = new Map<string, Map<string, PairRow>>();

    function place(op: Operation, system: 'diogoOps' | 'maeOps') {
      const mKey = monthKeyOf(op);
      const weekLabel = op.week_label ?? 'sem semana';
      const ticker = op.asset?.ticker ?? 'sem ativo';
      const pairKey = `${weekLabel}|${ticker}|${op.option_type}`;

      if (!byMonth.has(mKey)) byMonth.set(mKey, new Map());
      const pairs = byMonth.get(mKey)!;
      if (!pairs.has(pairKey)) {
        pairs.set(pairKey, { key: pairKey, weekLabel, ticker, optionType: op.option_type, diogoOps: [], maeOps: [] });
      }
      pairs.get(pairKey)![system].push(op);
    }

    for (const op of diogoOps) place(op, 'diogoOps');
    for (const op of maeOps) place(op, 'maeOps');

    return Array.from(byMonth.entries())
      .sort((a, b) => {
        if (a[0] === 'sem-data') return 1;
        if (b[0] === 'sem-data') return -1;
        return a[0] < b[0] ? 1 : -1;
      })
      .map(([mKey, pairsMap]) => ({
        monthKey: mKey,
        label: mKey === 'sem-data' ? 'Sem data' : `${MONTH_NAMES[Number(mKey.slice(5, 7)) - 1]} de ${mKey.slice(0, 4)}`,
        rows: Array.from(pairsMap.values()).sort((a, b) => {
          const sampleA = a.diogoOps[0] ?? a.maeOps[0];
          const sampleB = b.diogoOps[0] ?? b.maeOps[0];
          const da = sampleA?.expiration || sampleA?.opened_at || '';
          const db = sampleB?.expiration || sampleB?.opened_at || '';
          return db.localeCompare(da);
        }),
      }));
  }, [diogoOps, maeOps]);

  const grandTotal = useMemo(() => {
    const allRows = months.flatMap((m) => m.rows);
    return totalsOfPairs(allRows);
  }, [months]);

  const loading = diogoOps === null || maeOps === null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
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
          Seu lucro líquido somado à comissão que vem da sua mãe, por operação e por mês. Cada linha é um trade —
          sua parte e a dela juntas, já que toda operação sua tem uma gêmea na conta dela. Só controle pessoal, não
          altera nada nos dois sistemas.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {loading && !error && <p className="mt-6 text-sm text-faint-foreground">Carregando…</p>}

        {!loading && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="overflow-x-auto rounded-xl border border-glass-border bg-glass backdrop-blur-xl">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-glass-border bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-faint-foreground">
                    <Th align="left">Semana / Ativo</Th>
                    <Th>Líquido (Diogo)</Th>
                    <Th>Líquido (Mãe)</Th>
                    <Th>Comissão (Mãe)</Th>
                    <Th>Sacado</Th>
                    <Th>Total (Líquido + Comissão)</Th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, i) => (
                    <MonthBlock key={month.monthKey} month={month} isFirst={i === 0} onToggleCommission={toggleCommissionWithdrawn} />
                  ))}
                  {months.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-faint-foreground">
                        Nenhuma operação registrada em nenhum dos dois sistemas ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
                {months.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-primary-accent bg-primary-accent/10 text-sm font-extrabold">
                      <Td align="left">Total geral</Td>
                      <Td><span className="text-accent">{formatBRL(grandTotal.diogoNet)}</span></Td>
                      <Td><span className="text-info">{formatBRL(grandTotal.maeNet)}</span></Td>
                      <Td><span className="text-warning">{formatBRL(grandTotal.commission)}</span></Td>
                      <Td>—</Td>
                      <Td><span className="text-foreground">{formatBRL(grandTotal.total)}</span></Td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p className="text-[11px] text-faint-foreground">
              * Líquido = prêmio bruto − IR, e quando é uma CALL exercida, também soma o ganho ou perda da venda da
              ação. Em operações ainda abertas, é uma estimativa (15% de IR) e ajusta sozinho quando fechar. Comissão
              = líquido da Mãe × % configurado na operação dela (normalmente 50%, editável na aba Prêmios de dentro
              do sistema Mãe). Total = Líquido (Diogo) + Comissão (Mãe) da mesma linha — é o que você realmente fica
              no bolso naquele trade, somando os dois lados.
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
  onToggleCommission: (maeOps: Operation[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const totals = totalsOfPairs(month.rows);

  return (
    <>
      {!isFirst && (
        <tr aria-hidden="true">
          <td colSpan={6} className="h-4 bg-transparent p-0" />
        </tr>
      )}
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer border-y border-primary-accent-border bg-white/[0.06] text-sm font-bold hover:bg-white/[0.08]"
      >
        <Td align="left">
          <span className="flex items-center gap-1.5 py-1">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {month.label}
          </span>
        </Td>
        <Td><span className="text-accent">{formatBRL(totals.diogoNet)}</span></Td>
        <Td><span className="text-info">{formatBRL(totals.maeNet)}</span></Td>
        <Td><span className="text-warning">{formatBRL(totals.commission)}</span></Td>
        <Td>—</Td>
        <Td><span className="text-foreground">{formatBRL(totals.total)}</span></Td>
      </tr>
      {open && month.rows.map((row) => <PairRowItem key={row.key} row={row} onToggleCommission={onToggleCommission} />)}
    </>
  );
}

function PairRowItem({ row, onToggleCommission }: { row: PairRow; onToggleCommission: (maeOps: Operation[]) => void }) {
  const d = aggregate(row.diogoOps);
  const m = aggregate(row.maeOps);
  const commission = row.maeOps.reduce((sum, op) => sum + commissionOf(op), 0);
  const hasDiogo = row.diogoOps.length > 0;
  const hasMae = row.maeOps.length > 0;
  const withdrawn = hasMae && row.maeOps.every((op) => !!op.commission_withdrawn_at);
  const sampleOp = row.diogoOps[0] ?? row.maeOps[0];

  return (
    <tr className="border-b border-glass-border/60">
      <Td align="left">
        <span className="pl-5">
          <span className="text-muted-foreground">{row.weekLabel}</span>{' '}
          <span className="font-semibold text-foreground">{row.ticker}</span>{' '}
          <span className="text-faint-foreground">({row.optionType})</span>
          {sampleOp?.expiration && <span className="ml-1 text-faint-foreground">· {formatDate(sampleOp.expiration)}</span>}
        </span>
      </Td>
      <Td>
        {hasDiogo ? (
          <span className="text-accent">
            {formatBRL(d.net)}
            {d.estimated && '*'}
          </span>
        ) : (
          '—'
        )}
      </Td>
      <Td>
        {hasMae ? (
          <span className="text-info">
            {formatBRL(m.net)}
            {m.estimated && '*'}
          </span>
        ) : (
          '—'
        )}
      </Td>
      <Td>
        {hasMae ? (
          <span className={cn('font-semibold', withdrawn ? 'text-faint-foreground' : 'text-warning')}>{formatBRL(commission)}</span>
        ) : (
          '—'
        )}
      </Td>
      <Td>
        {hasMae ? (
          <button
            onClick={() => onToggleCommission(row.maeOps)}
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
      <Td>
        <span className="font-semibold text-foreground">{formatBRL(d.net + commission)}</span>
      </Td>
    </tr>
  );
}

function Th({ children, align = 'center' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return <th className={cn('px-2.5 py-2', align === 'left' ? 'text-left' : 'text-center')}>{children}</th>;
}

function Td({ children, align = 'center' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return <td className={cn('px-2.5 py-1.5 font-tabular', align === 'left' ? 'text-left' : 'text-center')}>{children}</td>;
}
