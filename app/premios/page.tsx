'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, TrendingUp, Wallet, Pencil } from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import { IR_RATE } from '@/lib/calculations/finance';
import {
  listOperationsForSystem,
  listCommissionWithdrawals,
  markCommissionWithdrawn,
  unmarkCommissionWithdrawn,
} from '@/lib/supabase/premios-cross-system';
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
  const isClosed = op.status !== 'aberta';
  if (isClosed && op.ir_amount !== null && op.net_profit !== null) {
    return { ir: op.ir_amount, net: op.net_profit, estimated: false };
  }
  const estimatedIr = op.premium_received > 0 ? op.premium_received * IR_RATE : 0;
  return { ir: estimatedIr, net: op.premium_received - estimatedIr, estimated: true };
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

function aggregateCommission(ops: Operation[]): number {
  return ops.reduce((sum, op) => sum + computeRow(op).net * (op.commission_pct / 100), 0);
}

function monthKeyOf(op: Operation): string {
  const raw = op.expiration || op.opened_at;
  return raw && raw.length >= 7 ? raw.slice(0, 7) : 'sem-data';
}

interface WeekRow {
  periodKey: string;
  weekLabel: string;
  diogoOps: Operation[];
  maeOps: Operation[];
}

interface MonthGroup {
  monthKey: string;
  label: string;
  weeks: WeekRow[];
}

export default function PremiosCombinadosPage() {
  const [diogoOps, setDiogoOps] = useState<Operation[] | null>(null);
  const [maeOps, setMaeOps] = useState<Operation[] | null>(null);
  const [withdrawn, setWithdrawn] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function reload() {
    return Promise.all([listOperationsForSystem('diogo'), listOperationsForSystem('mae'), listCommissionWithdrawals()])
      .then(([d, m, w]) => {
        setDiogoOps(d);
        setMaeOps(m);
        setWithdrawn(Object.fromEntries(w.map((x) => [x.period_key, true])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar prêmios.'));
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggleWithdrawn(periodKey: string) {
    const isWithdrawn = !!withdrawn[periodKey];
    setWithdrawn((prev) => ({ ...prev, [periodKey]: !isWithdrawn }));
    try {
      if (isWithdrawn) await unmarkCommissionWithdrawn(periodKey);
      else await markCommissionWithdrawn(periodKey);
    } catch {
      setWithdrawn((prev) => ({ ...prev, [periodKey]: isWithdrawn }));
    }
  }

  const months = useMemo<MonthGroup[]>(() => {
    if (!diogoOps || !maeOps) return [];

    const byMonth = new Map<string, Map<string, { diogoOps: Operation[]; maeOps: Operation[] }>>();

    function place(op: Operation, system: 'diogoOps' | 'maeOps') {
      const mKey = monthKeyOf(op);
      const wLabel = op.week_label ?? '—';
      if (!byMonth.has(mKey)) byMonth.set(mKey, new Map());
      const weeks = byMonth.get(mKey)!;
      if (!weeks.has(wLabel)) weeks.set(wLabel, { diogoOps: [], maeOps: [] });
      weeks.get(wLabel)![system].push(op);
    }

    for (const op of diogoOps) place(op, 'diogoOps');
    for (const op of maeOps) place(op, 'maeOps');

    return Array.from(byMonth.entries())
      .sort((a, b) => {
        if (a[0] === 'sem-data') return 1;
        if (b[0] === 'sem-data') return -1;
        return a[0] < b[0] ? 1 : -1;
      })
      .map(([mKey, weeks]) => ({
        monthKey: mKey,
        label: mKey === 'sem-data' ? 'Sem data' : `${MONTH_NAMES[Number(mKey.slice(5, 7)) - 1]} de ${mKey.slice(0, 4)}`,
        weeks: Array.from(weeks.entries())
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([weekLabel, ops]) => ({
            periodKey: `${mKey}:${weekLabel}`,
            weekLabel,
            diogoOps: ops.diogoOps,
            maeOps: ops.maeOps,
          })),
      }));
  }, [diogoOps, maeOps]);

  const grandTotal = useMemo(() => {
    const allDiogo = diogoOps ?? [];
    const allMae = maeOps ?? [];
    const d = aggregate(allDiogo);
    const m = aggregate(allMae);
    const commission = aggregateCommission(allMae);
    return { d, m, commission, combined: d.net + commission };
  }, [diogoOps, maeOps]);

  const loading = diogoOps === null || maeOps === null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
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
          Visão combinada dos dois sistemas, por mês e semana. Só controle pessoal — não altera nada em nenhum dos
          dois sistemas.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {loading && !error && <p className="mt-6 text-sm text-faint-foreground">Carregando…</p>}

        {!loading && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="overflow-x-auto rounded-xl border border-glass-border bg-glass backdrop-blur-xl">
              <table className="w-full min-w-[1000px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-glass-border bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-faint-foreground">
                    <Th align="left">Mês / Semana</Th>
                    <Th>Bruto (Diogo)</Th>
                    <Th>IR (Diogo)</Th>
                    <Th>Líquido (Diogo)</Th>
                    <Th>Bruto (Mãe)</Th>
                    <Th>IR (Mãe)</Th>
                    <Th>Líquido (Mãe)</Th>
                    <Th>Comissão (Mãe)</Th>
                    <Th>Sacado</Th>
                    <Th>Prêmio + Comissão</Th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month) => (
                    <MonthBlock key={month.monthKey} month={month} withdrawn={withdrawn} onToggle={toggleWithdrawn} />
                  ))}
                  {months.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-faint-foreground">
                        Nenhuma operação registrada em nenhum dos dois sistemas ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
                {months.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-glass-border bg-white/[0.04] font-bold">
                      <Td align="left">Total geral</Td>
                      <Td><span className="text-accent">{formatBRL(grandTotal.d.gross)}</span></Td>
                      <Td><span className="text-danger">{formatBRL(grandTotal.d.ir)}</span></Td>
                      <Td><span className="text-accent">{formatBRL(grandTotal.d.net)}</span></Td>
                      <Td><span className="text-info">{formatBRL(grandTotal.m.gross)}</span></Td>
                      <Td><span className="text-danger">{formatBRL(grandTotal.m.ir)}</span></Td>
                      <Td><span className="text-info">{formatBRL(grandTotal.m.net)}</span></Td>
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
              ação (Strike vs Preço Médio). Em operações ainda abertas, é uma estimativa (15% de IR sobre o prêmio,
              sem considerar venda de ação) e ajusta sozinho quando a operação fechar. Comissão = líquido da Mãe × %
              configurado em cada operação dela (normalmente 50%, editável na aba Prêmios de dentro do sistema Mãe).
              Prêmio + Comissão = líquido do Diogo + comissão da Mãe, na mesma semana.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthBlock({
  month,
  withdrawn,
  onToggle,
}: {
  month: MonthGroup;
  withdrawn: Record<string, boolean>;
  onToggle: (periodKey: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const allDiogoOps = month.weeks.flatMap((w) => w.diogoOps);
  const allMaeOps = month.weeks.flatMap((w) => w.maeOps);
  const d = aggregate(allDiogoOps);
  const m = aggregate(allMaeOps);
  const commission = aggregateCommission(allMaeOps);

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer border-b border-glass-border bg-white/[0.02] font-semibold hover:bg-white/[0.04]"
      >
        <Td align="left">
          <span className="flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {month.label}
          </span>
        </Td>
        <Td><span className="text-accent">{formatBRL(d.gross)}</span></Td>
        <Td><span className="text-danger">{formatBRL(d.ir)}</span></Td>
        <Td><span className="text-accent">{formatBRL(d.net)}</span></Td>
        <Td><span className="text-info">{formatBRL(m.gross)}</span></Td>
        <Td><span className="text-danger">{formatBRL(m.ir)}</span></Td>
        <Td><span className="text-info">{formatBRL(m.net)}</span></Td>
        <Td><span className="text-warning">{formatBRL(commission)}</span></Td>
        <Td>—</Td>
        <Td><span className="text-foreground">{formatBRL(d.net + commission)}</span></Td>
      </tr>
      {open &&
        month.weeks.map((week) => (
          <WeekRowItem key={week.periodKey} week={week} withdrawn={!!withdrawn[week.periodKey]} onToggle={onToggle} />
        ))}
    </>
  );
}

function WeekRowItem({
  week,
  withdrawn,
  onToggle,
}: {
  week: WeekRow;
  withdrawn: boolean;
  onToggle: (periodKey: string) => void;
}) {
  const d = aggregate(week.diogoOps);
  const m = aggregate(week.maeOps);
  const commission = aggregateCommission(week.maeOps);
  const hasMaeData = week.maeOps.length > 0;

  return (
    <tr className="border-b border-glass-border/60">
      <Td align="left">
        <span className="pl-5 text-muted-foreground">{week.weekLabel}</span>
      </Td>
      <Td>{d.gross > 0 ? <span className="text-accent">{formatBRL(d.gross)}{d.estimated && '*'}</span> : '—'}</Td>
      <Td>{d.gross > 0 ? <span className="text-danger">{formatBRL(d.ir)}</span> : '—'}</Td>
      <Td>{d.gross > 0 ? <span className="text-accent">{formatBRL(d.net)}</span> : '—'}</Td>
      <Td>{m.gross > 0 ? <span className="text-info">{formatBRL(m.gross)}{m.estimated && '*'}</span> : '—'}</Td>
      <Td>{m.gross > 0 ? <span className="text-danger">{formatBRL(m.ir)}</span> : '—'}</Td>
      <Td>{m.gross > 0 ? <span className="text-info">{formatBRL(m.net)}</span> : '—'}</Td>
      <Td>
        {hasMaeData ? (
          <span className={cn('font-semibold', withdrawn ? 'text-faint-foreground' : 'text-warning')}>
            {formatBRL(commission)}
          </span>
        ) : (
          '—'
        )}
      </Td>
      <Td>
        {hasMaeData ? (
          <button
            onClick={() => onToggle(week.periodKey)}
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
      <Td><span className="font-semibold text-foreground">{formatBRL(d.net + commission)}</span></Td>
    </tr>
  );
}

function Th({ children, align = 'center' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return <th className={cn('px-2.5 py-2', align === 'left' ? 'text-left' : 'text-center')}>{children}</th>;
}

function Td({ children, align = 'center' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return <td className={cn('px-2.5 py-1.5 font-tabular', align === 'left' ? 'text-left' : 'text-center')}>{children}</td>;
}
