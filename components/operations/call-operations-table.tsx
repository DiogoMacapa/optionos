'use client';

import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Trash2, Wallet, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WeekRangePicker } from '@/components/operations/week-range-picker';
import { DatePickerField } from '@/components/operations/date-picker-field';
import { ExerciseRiskGauge } from '@/components/operations/exercise-risk-gauge';
import { RiskGaugeSpeedometer } from '@/components/operations/risk-gauge-speedometer';
import { computeRollRecommendation } from '@/lib/risk/roll-recommendation';
import { formatBRL, formatPct, formatNumber, formatDate, parseBRNumber, cn } from '@/lib/utils';
import {
  updateOperationFields,
  findOrCreateAsset,
  deleteOperation,
  createWithdrawal,
  deleteWithdrawal,
  getStockPosition,
} from '@/lib/supabase/queries';
import { calculateNetProfit, calculateStockSaleResult } from '@/lib/calculations/finance';
import type { Operation, Withdrawal } from '@/lib/types/database';

interface CallOperationsTableProps {
  operations: Operation[];
  withdrawalsByOperation: Record<string, Withdrawal>;
  irFrozen: boolean;
  onChanged: () => void;
  onClose: (op: Operation) => void;
}

/**
 * Colunas seguindo a planilha "Venda Call - Diogo": Status, Semana,
 * Cotação, Ativo, Ticker (código da série), Data, Qnt, Prêmio Venda,
 * Total Prêmio, Strike, Spread, PM, Lucro/Prejuízo, Prêmio+L/P,
 * Distância, Taxa, Prêmio Recompra, Total Recompra, Resultado, IR,
 * Lucro Final, Eficiência, Exercido?.
 *
 * Diferenças reais de PUT (validadas com a planilha):
 *   - PM (preço médio das ações) substitui Caixa/Garantia/Cobertura
 *     (não fazem sentido em Covered Call — a "garantia" já são as
 *     ações que o usuário possui)
 *   - Taxa = Prêmio ÷ COTAÇÃO (na PUT é ÷ Strike)
 *   - Lucro/Prejuízo = Strike − PM (por ação) — só existe em CALL
 *   - IR sobre o prêmio BRUTO quando não exercida; sobre
 *     (Prêmio + (Strike−PM)×Qtd) quando exercida
 */
function calcCallRow(op: Operation, averagePrice: number | null, irFrozen: boolean) {
  const quote = op.reference_quote;
  const strike = op.strike;
  const premium = op.quantity > 0 ? op.premium_received / op.quantity : 0; // Prêmio Venda (por ação)
  const exercised = op.exercised_label === 'Sim';

  const spread = quote !== null && quote !== undefined ? quote - strike : null;
  const distance = quote !== null && quote !== undefined && quote !== 0 ? (quote - strike) / quote : null;
  const rate = quote !== null && quote !== undefined && quote !== 0 ? premium / quote : 0; // Taxa = Prêmio ÷ Cotação

  const lucroPrejuizoPorAcao = averagePrice !== null ? strike - averagePrice : null; // por ação
  const stockSaleResult = exercised && averagePrice !== null ? calculateStockSaleResult(strike, averagePrice, op.quantity) : 0;

  const totalPremium = op.premium_received;
  const buybackPerShare = op.buyback_premium;
  const totalBuyback = buybackPerShare !== null && buybackPerShare !== undefined ? buybackPerShare * op.quantity : null;

  let ir: number | null = null;
  let netProfit: number | null = null;
  let resultado: number | null = null;
  let efficiency: number | null = null;

  if (op.status === 'aberta') {
    if (exercised && averagePrice !== null) {
      const live = calculateNetProfit({
        optionType: 'CALL',
        premiumReceived: totalPremium,
        exercised: true,
        strikeVsAveragePriceResult: stockSaleResult,
        irFrozen,
      });
      resultado = live.grossResult;
      ir = live.ir;
      netProfit = live.netProfit;
      efficiency = live.efficiencyPct;
    } else if (totalBuyback !== null) {
      const live = calculateNetProfit({ optionType: 'CALL', premiumReceived: totalPremium, buybackCost: totalBuyback, irFrozen });
      resultado = live.grossResult;
      ir = live.ir;
      netProfit = live.netProfit;
      efficiency = live.efficiencyPct;
    }
  } else {
    resultado = op.gross_result ?? null;
    ir = op.ir_amount ?? null;
    netProfit = op.net_profit ?? null;
    efficiency = op.efficiency_pct ?? null;
  }

  return { strike, quote, premium, spread, distance, rate, lucroPrejuizoPorAcao, totalPremium, totalBuyback, resultado, ir, netProfit, efficiency };
}

function InlineField({
  initialValue,
  onCommit,
  placeholder,
  width,
  mono = true,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  placeholder?: string;
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
        'rounded border border-border bg-surface-elevated px-1.5 py-1 text-[11.5px] text-foreground outline-none',
        mono && 'font-tabular'
      )}
    />
  );
}

export function CallOperationsTable({ operations, withdrawalsByOperation, irFrozen, onChanged, onClose }: CallOperationsTableProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const [averagePrices, setAveragePrices] = useState<Record<string, number | null>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastAutoFetchedTicker = useRef<Record<string, string>>({});

  // Carrega o PM de cada combinação (ativo, titular) das operações abertas —
  // fora do render, disparado quando a lista de operações muda.
  useEffect(() => {
    let cancelled = false;
    const openOps = operations.filter((o) => o.status === 'aberta');
    const uniqueKeys = new Map<string, { assetId: string; holderId: string }>();
    for (const op of openOps) {
      const key = `${op.asset_id}-${op.holder_id}`;
      if (!uniqueKeys.has(key)) uniqueKeys.set(key, { assetId: op.asset_id, holderId: op.holder_id });
    }
    (async () => {
      const entries = await Promise.all(
        Array.from(uniqueKeys.entries()).map(async ([key, { assetId, holderId }]) => {
          try {
            const position = await getStockPosition(assetId, holderId);
            return [key, position?.average_price ?? null] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );
      if (!cancelled) setAveragePrices(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [operations]);

  async function saveField(op: Operation, patch: Parameters<typeof updateOperationFields>[1]) {
    setSavingId(op.id);
    try {
      await updateOperationFields(op.id, patch);
      onChanged();
    } finally {
      setSavingId(null);
    }
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

  async function handleDelete(op: Operation) {
    const label = op.asset?.ticker ?? 'esta operação';
    if (!window.confirm(`Excluir ${label} definitivamente? Essa ação não pode ser desfeita.`)) return;
    setSavingId(op.id);
    try {
      await deleteOperation(op.id);
      onChanged();
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleWithdrawal(op: Operation) {
    const existing = withdrawalsByOperation[op.id];
    setSavingId(op.id);
    try {
      if (existing) {
        await deleteWithdrawal(existing.id);
      } else {
        const amount = op.net_profit ?? op.premium_received;
        await createWithdrawal({ holderId: op.holder_id, operationId: op.id, amount, notes: `Saque do prêmio — ${op.asset?.ticker ?? ''}` });
      }
      onChanged();
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleEquityImpact(op: Operation) {
    setSavingId(op.id);
    try {
      await updateOperationFields(op.id, { counts_toward_equity: !op.counts_toward_equity });
      onChanged();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1700px] border-collapse">
        <thead>
          <tr>
            <Th>Status</Th>
            <Th>Semana</Th>
            <Th>Ativo</Th>
            <Th>Cotação</Th>
            <Th>Ticker</Th>
            <Th>Data</Th>
            <Th>Qnt</Th>
            <Th>Prêmio Venda</Th>
            <Th>Total Prêmio</Th>
            <Th>Strike</Th>
            <Th>Delta</Th>
            <Th>Spread</Th>
            <Th>PM</Th>
            <Th>Lucro/Prejuízo</Th>
            <Th>Distância</Th>
            <Th>Risco</Th>
            <Th>Recomendação</Th>
            <Th>Taxa</Th>
            <Th>Prêmio Recompra</Th>
            <Th>Total Recompra</Th>
            <Th>Resultado</Th>
            <Th>IR (15%)</Th>
            <Th>Lucro Final</Th>
            <Th>Eficiência</Th>
            <Th>Prejuízo</Th>
            <Th>Exercido?</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => {
            const key = `${op.asset_id}-${op.holder_id}`;
            const averagePrice = averagePrices[key] ?? null;
            const r = calcCallRow(op, averagePrice, irFrozen);
            const editable = op.status === 'aberta';

            return (
              <tr key={op.id} className={cn('border-t border-border transition-opacity', !editable && 'opacity-60 hover:opacity-100')}>
                <Td>
                  <Badge variant={op.status === 'aberta' ? 'outline' : 'default'}>{op.status}</Badge>
                </Td>
                <Td width={90}>
                  {editable ? (
                    <WeekRangePicker value={op.week_label} onSelect={(label, expiration) => saveField(op, { week_label: label, expiration })} />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{op.week_label ?? '—'}</span>
                  )}
                </Td>
                <Td width={78}>
                  {editable ? (
                    <InlineField key={`ativo-${op.id}-${op.asset?.ticker ?? ''}`} initialValue={op.asset?.ticker ?? ''} onCommit={(v) => saveTicker(op, v)} placeholder="BPAC11" width={68} />
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
                <Td width={90}>
                  {editable ? (
                    <InlineField
                      key={`symbol-${op.id}-${op.option_symbol ?? ''}`}
                      initialValue={op.option_symbol ?? ''}
                      onCommit={(v) => saveField(op, { option_symbol: v.trim() === '' ? null : v.trim().toUpperCase() })}
                      placeholder="BPACW56"
                      width={78}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-foreground">{op.option_symbol ?? '—'}</span>
                  )}
                </Td>
                <Td width={100}>
                  {editable ? (
                    <DatePickerField value={op.opened_at?.slice(0, 10) ?? null} onSelect={(date) => saveField(op, { opened_at: date })} />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.opened_at)}</span>
                  )}
                </Td>
                <Td width={70}>
                  {editable ? (
                    <InlineField key={`qty-${op.id}-${op.quantity}`} initialValue={String(op.quantity)} onCommit={(v) => saveField(op, { quantity: Math.round(parseBRNumber(v)) })} placeholder="0" width={56} />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{op.quantity.toLocaleString('pt-BR')}</span>
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
                    <InlineField key={`strike-${op.id}-${r.strike}`} initialValue={formatNumber(r.strike, 2)} onCommit={(v) => saveField(op, { strike: parseBRNumber(v) })} placeholder="0,00" width={56} />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{formatNumber(r.strike, 2)}</span>
                  )}
                </Td>
                <Td width={70}>
                  <InlineField
                    key={`delta-${op.id}-${op.delta_at_open}`}
                    initialValue={op.delta_at_open !== null && op.delta_at_open !== undefined ? String(op.delta_at_open).replace('.', ',') : ''}
                    onCommit={(v) => saveField(op, { delta_at_open: v.trim() === '' ? null : parseBRNumber(v) })}
                    placeholder="0,15"
                    width={56}
                  />
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.spread !== null ? formatNumber(r.spread, 2) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-foreground">{averagePrice !== null ? formatNumber(averagePrice, 2) : '—'}</span>
                </Td>
                <Td>
                  <span className={cn('font-tabular text-[11.5px]', (r.lucroPrejuizoPorAcao ?? 0) >= 0 ? 'text-accent' : 'text-danger')}>
                    {r.lucroPrejuizoPorAcao !== null ? formatNumber(r.lucroPrejuizoPorAcao, 2) : '—'}
                  </span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.distance !== null ? formatPct(r.distance * 100, 2) : '—'}</span>
                </Td>
                <Td width={144}>
                  <ExerciseRiskGauge strike={r.strike} quote={r.quote} optionType="CALL" />
                </Td>
                <Td width={100}>
                  <RiskGaugeSpeedometer recommendation={computeRollRecommendation(r.strike, r.quote, 'CALL')} />
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{formatPct(r.rate * 100, 2)}</span>
                </Td>
                <Td width={90}>
                  {editable ? (
                    <InlineField
                      key={`buybackshare-${op.id}-${op.buyback_premium}`}
                      initialValue={op.buyback_premium !== null && op.buyback_premium !== undefined ? formatNumber(op.buyback_premium, 2) : ''}
                      onCommit={(v) => saveField(op, { buyback_premium: v.trim() === '' ? null : parseBRNumber(v) })}
                      placeholder="vazio"
                      width={64}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-foreground">{op.buyback_premium !== null && op.buyback_premium !== undefined ? formatNumber(op.buyback_premium, 2) : '—'}</span>
                  )}
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.totalBuyback !== null ? formatBRL(r.totalBuyback) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.resultado !== null ? formatBRL(r.resultado) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-danger">{r.ir !== null ? formatBRL(r.ir) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] font-bold text-accent">{r.netProfit !== null ? formatBRL(r.netProfit) : '—'}</span>
                </Td>
                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.efficiency !== null ? formatPct(r.efficiency, 1) : '—'}</span>
                </Td>
                <Td width={90}>
                  {r.netProfit !== null && r.netProfit < 0 ? (
                    <span
                      title="Prejuízo — confira a compensação de IR no seu app externo"
                      className="inline-flex items-center gap-1 rounded border border-danger/30 bg-danger-muted px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                    >
                      Conferir IR
                    </span>
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>
                <Td width={100}>
                  <select
                    value={op.exercised_label ?? ''}
                    onChange={(e) => saveField(op, { exercised_label: (e.target.value || null) as Operation['exercised_label'] })}
                    className={cn(
                      'w-full rounded border px-1.5 py-1 text-[11px] outline-none',
                      op.exercised_label ? 'border-border bg-transparent text-foreground' : 'border-border bg-surface-elevated text-faint-foreground'
                    )}
                  >
                    <option value="">—</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Rolagem">Rolagem</option>
                  </select>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {editable && (
                      <button onClick={() => onClose(op)} className="whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-surface-hover">
                        Encerrar
                      </button>
                    )}
                    {!editable && (
                      <button
                        onClick={() => handleToggleWithdrawal(op)}
                        title={withdrawalsByOperation[op.id] ? 'Marcado como sacado — clique para desmarcar' : 'Marcar prêmio desta operação como sacado'}
                        className={cn(
                          'flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] font-medium',
                          withdrawalsByOperation[op.id] ? 'border-warning/40 bg-warning-muted text-warning' : 'border-border bg-surface-elevated text-foreground hover:bg-surface-hover'
                        )}
                      >
                        <Wallet className="h-3 w-3" />
                        {withdrawalsByOperation[op.id] ? 'Sacado' : 'Sacar'}
                      </button>
                    )}
                    {!editable && (
                      <button
                        onClick={() => handleToggleEquityImpact(op)}
                        title={op.counts_toward_equity ? 'Conta no cálculo de Patrimônio — clique para marcar como histórico' : 'Marcada como histórico — não conta no Patrimônio'}
                        className={cn(
                          'flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] font-medium',
                          !op.counts_toward_equity ? 'border-info/40 bg-info/10 text-info' : 'border-border bg-surface-elevated text-faint-foreground hover:bg-surface-hover'
                        )}
                      >
                        <History className="h-3 w-3" />
                        {op.counts_toward_equity ? 'Conta' : 'Histórico'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(op)} title="Excluir operação" className="text-faint-foreground hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {savingId === op.id && <RefreshCw className="h-3 w-3 animate-spin text-accent" />}
                  </div>
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
  return <th className="whitespace-nowrap px-1.5 pb-2 text-left text-[9.5px] font-bold uppercase tracking-wide text-faint-foreground">{children}</th>;
}

function Td({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <td className="px-1.5 py-1 align-middle" style={{ width }}>
      {children}
    </td>
  );
}
