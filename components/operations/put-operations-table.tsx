'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WeekRangePicker } from '@/components/operations/week-range-picker';
import { formatBRL, formatPct, formatNumber, formatDate, parseBRNumber, cn } from '@/lib/utils';
import { updateOperationFields, updateAssetCeiling } from '@/lib/supabase/queries';
import type { Operation } from '@/lib/types/database';

interface PutOperationsTableProps {
  operations: Operation[];
  onChanged: () => void;
  onClose: (op: Operation) => void;
}

function calcPutRow(op: Operation) {
  const strike = op.strike;
  const premium = op.premium_received / (op.quantity || 1); // prêmio por ação
  const ceiling = op.asset?.ceiling_price ?? null;
  const isExpensive = ceiling !== null && strike > ceiling;

  const guarantee = strike * op.quantity;
  const rate = strike > 0 ? premium / strike : 0;

  const totalPremium = op.premium_received;
  const totalBuyback = op.close_price ?? null;
  const sellMinusBuyback = op.status !== 'aberta' && totalBuyback !== null ? totalPremium - totalBuyback : null;
  const ir = op.ir_amount ?? null;
  const netProfit = op.net_profit ?? null;
  const efficiency = op.efficiency_pct ?? null;

  return { strike, premium, ceiling, isExpensive, guarantee, rate, totalPremium, totalBuyback, sellMinusBuyback, ir, netProfit, efficiency };
}

export function PutOperationsTable({ operations, onChanged, onClose }: PutOperationsTableProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ceilingDrafts, setCeilingDrafts] = useState<Record<string, string>>({});

  async function saveField(op: Operation, patch: Parameters<typeof updateOperationFields>[1]) {
    setSavingId(op.id);
    try {
      await updateOperationFields(op.id, patch);
      onChanged();
    } finally {
      setSavingId(null);
    }
  }

  async function saveCeiling(op: Operation, raw: string) {
    if (!op.asset) return;
    const value = raw.trim() === '' ? null : parseBRNumber(raw);
    await updateAssetCeiling(op.asset.id, value);
    onChanged();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1300px] border-collapse">
        <thead>
          <tr>
            <Th>Status</Th>
            <Th>Semana</Th>
            <Th>Ativo</Th>
            <Th>Prêmio venda</Th>
            <Th>Total prêmio</Th>
            <Th>Strike</Th>
            <Th>Teto</Th>
            <Th>Garantia</Th>
            <Th>Taxa</Th>
            <Th>Vencimento</Th>
            <Th>Total recompra</Th>
            <Th>Venda−Recompra</Th>
            <Th>IR (15%)</Th>
            <Th>Lucro final</Th>
            <Th>Eficiência</Th>
            <Th>Exercido?</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => {
            const r = calcPutRow(op);
            const editable = op.status === 'aberta';
            return (
              <tr key={op.id} className="border-t border-border">
                <Td>
                  <Badge variant={op.status === 'aberta' ? 'outline' : 'default'}>{op.status}</Badge>
                </Td>
                <Td width={90}>
                  {editable ? (
                    <WeekRangePicker
                      value={op.week_label}
                      onSelect={(label, expiration) => saveField(op, { week_label: label, expiration })}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{op.week_label ?? '—'}</span>
                  )}
                </Td>
                <Td width={80}>
                  <span className="font-tabular text-xs font-bold text-foreground">{op.asset?.ticker ?? '—'}</span>
                </Td>
                <Td width={80}>
                  <span className="font-tabular text-[11.5px] text-muted-foreground">{formatNumber(r.premium, 2)}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] font-bold text-accent">{formatBRL(r.totalPremium)}</span>
                </Td>
                <Td width={80}>
                  <span
                    className={cn(
                      'font-tabular text-[11.5px]',
                      r.isExpensive ? 'font-bold text-danger' : 'text-muted-foreground'
                    )}
                  >
                    {formatNumber(r.strike, 2)}
                  </span>
                </Td>
                <Td width={130}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={r.isExpensive ? 'danger' : 'success'}>{r.isExpensive ? 'Cara' : 'Barata'}</Badge>
                    <input
                      defaultValue={ceilingDrafts[op.id] ?? (r.ceiling !== null ? String(r.ceiling).replace('.', ',') : '')}
                      onChange={(e) => setCeilingDrafts((d) => ({ ...d, [op.id]: e.target.value }))}
                      onBlur={(e) => saveCeiling(op, e.target.value)}
                      placeholder="teto"
                      className="w-14 rounded border border-border bg-surface-elevated px-1 py-0.5 font-tabular text-[10px] text-foreground outline-none"
                      title={`Preço-teto de ${op.asset?.ticker} — se o Strike passar disso, fica "Cara"`}
                    />
                  </div>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{formatBRL(r.guarantee)}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{formatPct(r.rate * 100, 2)}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.expiration)}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{r.totalBuyback !== null ? formatBRL(r.totalBuyback) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{r.sellMinusBuyback !== null ? formatBRL(r.sellMinusBuyback) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-danger">{r.ir !== null ? formatBRL(r.ir) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] font-bold text-accent">{r.netProfit !== null ? formatBRL(r.netProfit) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{r.efficiency !== null ? formatPct(r.efficiency, 1) : '—'}</span>
                </Td>
                <Td>
                  {op.exercised ? (
                    <Badge variant="danger">Sim</Badge>
                  ) : op.status !== 'aberta' ? (
                    <Badge>Não</Badge>
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>
                <Td>
                  {editable && (
                    <button
                      onClick={() => onClose(op)}
                      className="whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-surface-hover"
                    >
                      Encerrar
                    </button>
                  )}
                  {savingId === op.id && <RefreshCw className="ml-1 inline h-3 w-3 animate-spin text-accent" />}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-1.5 pb-2 text-left text-[9.5px] font-bold uppercase tracking-wide text-faint-foreground">
      {children}
    </th>
  );
}

function Td({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <td className="px-1.5 py-1 align-middle" style={{ width }}>
      {children}
    </td>
  );
}
