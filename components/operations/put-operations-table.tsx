'use client';

import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WeekRangePicker } from '@/components/operations/week-range-picker';
import { DatePickerField } from '@/components/operations/date-picker-field';
import { formatBRL, formatPct, formatNumber, formatDate, parseBRNumber, cn } from '@/lib/utils';
import { updateOperationFields, updateAssetCeiling, findOrCreateAsset } from '@/lib/supabase/queries';
import type { Operation } from '@/lib/types/database';

interface PutOperationsTableProps {
  operations: Operation[];
  onChanged: () => void;
  onClose: (op: Operation) => void;
}

/**
 * Colunas na ordem EXATA da planilha original do usuário:
 * Status | Semana | Cotação | Será Exercido? | Ticker | Data | Qnt |
 * Prêmio Venda | Total Prêmio | Strike | Distância do strike | Teto |
 * Spread | Garantia | Caixa | Tem Cobertura? | Taxa (%) | Vencimento |
 * Valor Recompra | Total Recompra | Venda-Recompra | IR (15%) |
 * Lucro Final | Eficiência (%) | Exercido?
 */
function calcPutRow(op: Operation) {
  const quote = op.reference_quote;
  const strike = op.strike;
  const premium = op.premium_received / (op.quantity || 1); // Prêmio Venda (por ação)
  const ceiling = op.asset?.ceiling_price ?? null;
  const isExpensive = ceiling !== null && strike > ceiling;

  const distance = quote !== null && quote !== undefined && quote !== 0 ? (quote - strike) / quote : null;
  const spread = quote !== null && quote !== undefined ? quote - strike : null;
  const guarantee = strike * op.quantity;
  const cash = op.committed_capital; // usamos Capital Comprometido como "Caixa" de referência da operação
  const hasCoverage = cash !== null && cash !== undefined ? cash >= guarantee : null;
  const rate = strike > 0 ? premium / strike : 0;

  const totalPremium = op.premium_received;
  const buybackPerShare = op.buyback_premium; // Valor Recompra (por ação)
  const totalBuyback = op.close_price; // Total Recompra
  const sellMinusBuyback = totalBuyback !== null && totalBuyback !== undefined ? totalPremium - totalBuyback : null;
  const ir = op.ir_amount ?? null;
  const netProfit = op.net_profit ?? null;
  const efficiency = op.efficiency_pct ?? null;

  return {
    quote, strike, premium, ceiling, isExpensive, distance, spread, guarantee, cash, hasCoverage, rate,
    totalPremium, buybackPerShare, totalBuyback, sellMinusBuyback, ir, netProfit, efficiency,
  };
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
      <table className="w-full min-w-[2200px] border-collapse">
        <thead>
          <tr>
            <Th>Status</Th>
            <Th>Semana</Th>
            <Th>Ativo</Th>
            <Th>Cotação</Th>
            <Th>Será Exercido?</Th>
            <Th>Ticker</Th>
            <Th>Data</Th>
            <Th>Qnt</Th>
            <Th>Prêmio Venda</Th>
            <Th>Total Prêmio</Th>
            <Th>Strike</Th>
            <Th>Distância do strike</Th>
            <Th>Teto</Th>
            <Th>Spread</Th>
            <Th>Garantia</Th>
            <Th>Caixa</Th>
            <Th>Tem Cobertura?</Th>
            <Th>Taxa (%)</Th>
            <Th>Vencimento</Th>
            <Th>Valor Recompra</Th>
            <Th>Total Recompra</Th>
            <Th>Venda-Recompra</Th>
            <Th>IR (15%)</Th>
            <Th>Lucro Final</Th>
            <Th>Eficiência (%)</Th>
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
                {/* Status */}
                <Td>
                  <Badge variant={op.status === 'aberta' ? 'outline' : 'default'}>{op.status}</Badge>
                </Td>

                {/* Semana */}
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

                {/* Ativo */}
                <Td width={78}>
                  {editable ? (
                    <InlineField
                      key={`ativo-${op.id}-${op.asset?.ticker ?? ''}`}
                      initialValue={op.asset?.ticker ?? ''}
                      onCommit={(v) => saveTicker(op, v)}
                      placeholder="VALE3"
                      width={68}
                    />
                  ) : (
                    <span className="font-tabular text-xs font-bold text-foreground">{op.asset?.ticker ?? '—'}</span>
                  )}
                </Td>

                {/* Cotação */}
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

                {/* Será Exercido? — projeção baseada em strike vs cotação atual (informativo, não editável) */}
                <Td>
                  {r.quote !== null && r.quote !== undefined ? (
                    <Badge variant={r.quote < r.strike ? 'danger' : 'success'}>{r.quote < r.strike ? 'Provável' : 'Improvável'}</Badge>
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>

                {/* Ticker — código da série de opção (ex: VALEW76), digitado manualmente */}
                <Td width={90}>
                  {editable ? (
                    <InlineField
                      key={`symbol-${op.id}-${op.option_symbol ?? ''}`}
                      initialValue={op.option_symbol ?? ''}
                      onCommit={(v) => saveField(op, { option_symbol: v.trim() === '' ? null : v.trim().toUpperCase() })}
                      placeholder="VALEW76"
                      width={78}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-foreground">{op.option_symbol ?? '—'}</span>
                  )}
                </Td>

                {/* Data */}
                <Td width={100}>
                  {editable ? (
                    <DatePickerField value={op.opened_at?.slice(0, 10) ?? null} onSelect={(date) => saveField(op, { opened_at: date })} />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.opened_at)}</span>
                  )}
                </Td>

                {/* Qnt */}
                <Td width={70}>
                  {editable ? (
                    <InlineField
                      key={`qty-${op.id}-${op.quantity}`}
                      initialValue={String(op.quantity)}
                      onCommit={(v) => saveField(op, { quantity: Math.round(parseBRNumber(v)) })}
                      placeholder="0"
                      width={56}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{op.quantity.toLocaleString('pt-BR')}</span>
                  )}
                </Td>

                {/* Prêmio Venda */}
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

                {/* Total Prêmio */}
                <Td>
                  <span className="font-tabular text-[11.5px] font-bold text-accent">{formatBRL(r.totalPremium)}</span>
                </Td>

                {/* Strike */}
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

                {/* Distância do strike */}
                <Td>
                  <span className={cn('font-tabular text-[11.5px]', r.distance !== null && r.distance >= 0 ? 'text-accent' : 'text-danger')}>
                    {r.distance !== null ? formatPct(r.distance * 100, 2) : '—'}
                  </span>
                </Td>

                {/* Teto */}
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

                {/* Spread */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{r.spread !== null ? formatNumber(r.spread, 2) : '—'}</span>
                </Td>

                {/* Garantia */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{formatBRL(r.guarantee)}</span>
                </Td>

                {/* Caixa */}
                <Td width={100}>
                  {editable ? (
                    <InlineField
                      key={`cash-${op.id}-${r.cash}`}
                      initialValue={r.cash !== null && r.cash !== undefined ? formatNumber(r.cash, 2) : ''}
                      onCommit={(v) => saveField(op, { committed_capital: v.trim() === '' ? null : parseBRNumber(v) })}
                      placeholder="0,00"
                      width={80}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{r.cash !== null ? formatBRL(r.cash) : '—'}</span>
                  )}
                </Td>

                {/* Tem Cobertura? */}
                <Td>
                  {r.hasCoverage !== null ? (
                    <Badge variant={r.hasCoverage ? 'success' : 'danger'}>{r.hasCoverage ? 'Tem' : 'Não'}</Badge>
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>

                {/* Taxa (%) */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{formatPct(r.rate * 100, 2)}</span>
                </Td>

                {/* Vencimento */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.expiration)}</span>
                </Td>

                {/* Valor Recompra (por ação) */}
                <Td width={90}>
                  {editable ? (
                    <InlineField
                      key={`buybackshare-${op.id}-${r.buybackPerShare}`}
                      initialValue={r.buybackPerShare !== null && r.buybackPerShare !== undefined ? formatNumber(r.buybackPerShare, 2) : ''}
                      onCommit={(v) => saveField(op, { buyback_premium: v.trim() === '' ? null : parseBRNumber(v) })}
                      placeholder="vazio"
                      width={64}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-foreground">{r.buybackPerShare !== null && r.buybackPerShare !== undefined ? formatNumber(r.buybackPerShare, 2) : '—'}</span>
                  )}
                </Td>

                {/* Total Recompra */}
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

                {/* Venda-Recompra */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{r.sellMinusBuyback !== null ? formatBRL(r.sellMinusBuyback) : '—'}</span>
                </Td>

                {/* IR (15%) */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-danger">{r.ir !== null ? formatBRL(r.ir) : '—'}</span>
                </Td>

                {/* Lucro Final */}
                <Td>
                  <span className="font-tabular text-[11.5px] font-bold text-accent">{r.netProfit !== null ? formatBRL(r.netProfit) : '—'}</span>
                </Td>

                {/* Eficiência (%) */}
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{r.efficiency !== null ? formatPct(r.efficiency, 1) : '—'}</span>
                </Td>

                {/* Exercido? */}
                <Td>
                  {op.exercised ? (
                    <Badge variant="danger">Sim</Badge>
                  ) : op.status !== 'aberta' ? (
                    <Badge>Não</Badge>
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>

                {/* Ações */}
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
