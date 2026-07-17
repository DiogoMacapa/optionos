'use client';

import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WeekRangePicker } from '@/components/operations/week-range-picker';
import { formatBRL, formatPct, formatNumber, formatDate, parseBRNumber, cn } from '@/lib/utils';
import { updateOperationFields, updateAssetCeiling, findOrCreateAsset } from '@/lib/supabase/queries';
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
  // Total recompra: null = ainda não preenchido (não confundir com 0 = recomprou de graça / expirou).
  const totalBuyback = op.close_price;
  const sellMinusBuyback = totalBuyback !== null && totalBuyback !== undefined ? totalPremium - totalBuyback : null;
  const ir = op.ir_amount ?? null;
  const netProfit = op.net_profit ?? null;
  const efficiency = op.efficiency_pct ?? null;

  return { strike, premium, ceiling, isExpensive, guarantee, rate, totalPremium, totalBuyback, sellMinusBuyback, ir, netProfit, efficiency };
}

/** Campo de texto com valor local — evita perder o que foi digitado até o onBlur salvar. */
function InlineField({
  initialValue,
  onCommit,
  placeholder,
  danger,
  width,
  mono = true,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  danger?: boolean;
  width?: number;
  mono?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initialValue) onCommit(value);
      }}
      placeholder={placeholder}
      style={{ width }}
      className={cn(
        'rounded border px-1.5 py-1 text-[11.5px] outline-none',
        mono && 'font-tabular',
        danger ? 'border-danger/60 bg-danger-muted text-danger' : 'border-border bg-surface-elevated text-foreground'
      )}
    />
  );
}

export function PutOperationsTable({ operations, onChanged, onClose }: PutOperationsTableProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastAutoFetchedTicker = useRef<Record<string, string>>({});

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

  async function saveTicker(op: Operation, raw: string) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker || ticker === op.asset?.ticker) return;
    const asset = await findOrCreateAsset(ticker);
    await saveField(op, { asset_id: asset.id });
    scheduleAutoQuote(op.id, ticker);
  }

  async function fetchQuote(id: string, ticker: string) {
    const t = ticker.trim();
    if (!t) return;
    setQuoteLoadingId(id);
    try {
      const res = await fetch(`/api/quote?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (res.ok) {
        const op = operations.find((o) => o.id === id);
        if (op) await saveField(op, { reference_quote: Number(data.price) });
      }
    } finally {
      setQuoteLoadingId(null);
    }
  }

  function scheduleAutoQuote(id: string, ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    if (!t || lastAutoFetchedTicker.current[id] === t) return;
    debounceTimers.current[id] = setTimeout(() => {
      lastAutoFetchedTicker.current[id] = t;
      fetchQuote(id, t);
    }, 700);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1600px] border-collapse">
        <thead>
          <tr>
            <Th>Status</Th>
            <Th>Data</Th>
            <Th>Semana</Th>
            <Th>Ativo</Th>
            <Th>Cotação</Th>
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
            <Th>Ações</Th>
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
                <Td width={82}>
                  <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.opened_at)}</span>
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
                <Td width={78}>
                  {editable ? (
                    <InlineField
                      key={`ticker-${op.id}-${op.asset?.ticker ?? ''}`}
                      initialValue={op.asset?.ticker ?? ''}
                      onCommit={(v) => saveTicker(op, v)}
                      placeholder="VALE3"
                      width={68}
                    />
                  ) : (
                    <span className="font-tabular text-xs font-bold text-foreground">{op.asset?.ticker ?? '—'}</span>
                  )}
                </Td>
                <Td width={92}>
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <InlineField
                        key={`quote-${op.id}-${op.reference_quote}`}
                        initialValue={op.reference_quote !== null ? String(op.reference_quote).replace('.', ',') : ''}
                        onCommit={(v) => saveField(op, { reference_quote: v.trim() === '' ? null : parseBRNumber(v) })}
                        placeholder="0,00"
                        width={54}
                      />
                      <button
                        onClick={() => fetchQuote(op.id, op.asset?.ticker ?? '')}
                        disabled={!op.asset?.ticker || quoteLoadingId === op.id}
                        title="Atualizar cotação"
                        className="shrink-0 text-faint-foreground hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RefreshCw className={cn('h-3 w-3', quoteLoadingId === op.id && 'animate-spin')} />
                      </button>
                    </div>
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{formatNumber(op.reference_quote, 2)}</span>
                  )}
                </Td>
                <Td width={80}>
                  {editable ? (
                    <InlineField
                      key={`premium-${op.id}-${r.premium}`}
                      initialValue={formatNumber(r.premium, 2)}
                      onCommit={(v) => saveField(op, { premium_received: parseBRNumber(v) * op.quantity })}
                      placeholder="0,00"
                      width={56}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{formatNumber(r.premium, 2)}</span>
                  )}
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] font-bold text-accent">{formatBRL(r.totalPremium)}</span>
                </Td>
                <Td width={80}>
                  {editable ? (
                    <InlineField
                      key={`strike-${op.id}-${r.strike}`}
                      initialValue={formatNumber(r.strike, 2)}
                      onCommit={(v) => saveField(op, { strike: parseBRNumber(v) })}
                      placeholder="0,00"
                      width={56}
                      danger={r.isExpensive}
                    />
                  ) : (
                    <span className={cn('font-tabular text-[11.5px]', r.isExpensive ? 'font-bold text-danger' : 'text-muted-foreground')}>
                      {formatNumber(r.strike, 2)}
                    </span>
                  )}
                </Td>
                <Td width={130}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={r.isExpensive ? 'danger' : 'success'}>{r.isExpensive ? 'Cara' : 'Barata'}</Badge>
                    <InlineField
                      key={`ceiling-${op.id}-${r.ceiling}`}
                      initialValue={r.ceiling !== null ? String(r.ceiling).replace('.', ',') : ''}
                      onCommit={(v) => saveCeiling(op, v)}
                      placeholder="teto"
                      width={48}
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
                <Td width={90}>
                  {editable ? (
                    <InlineField
                      key={`buyback-${op.id}-${r.totalBuyback}`}
                      initialValue={r.totalBuyback !== null && r.totalBuyback !== undefined ? formatNumber(r.totalBuyback, 2) : ''}
                      onCommit={(v) => saveField(op, { close_price: v.trim() === '' ? null : parseBRNumber(v) })}
                      placeholder="vazio"
                      width={64}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-foreground">{r.totalBuyback !== null ? formatBRL(r.totalBuyback) : '—'}</span>
                  )}
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
