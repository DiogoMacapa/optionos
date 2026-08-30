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
  updateAssetCeiling,
  findOrCreateAsset,
  deleteOperation,
  createWithdrawal,
  deleteWithdrawal,
} from '@/lib/supabase/queries';
import { calculateNetProfit } from '@/lib/calculations/finance';
import type { Operation, Withdrawal } from '@/lib/types/database';

interface PutOperationsTableProps {
  operations: Operation[];
  withdrawalsByOperation: Record<string, Withdrawal>;
  irFrozen: boolean;
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
/** Arredonda para 2 casas decimais — evita erro de ponto flutuante acumulado em valores monetários. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Arredonda para 4 casas decimais (mesma escala usada no banco para valores por ação). */
function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Formata com o mínimo de casas decimais necessário para representar o valor exato (2 a 4). */
function formatPreciseNumber(n: number): string {
  for (let decimals = 2; decimals <= 4; decimals++) {
    const rounded = Math.round((n + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
    if (Math.abs(rounded - n) < 1e-9) {
      return rounded.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function calcPutRow(op: Operation, irFrozen: boolean) {
  const quote = op.reference_quote;
  const strike = op.strike;
  const premium = op.quantity > 0 ? round4(op.premium_received / op.quantity) : 0;
  const ceiling = op.asset?.ceiling_price ?? null;
  const isExpensive = ceiling !== null && strike > ceiling;

  const distance = quote !== null && quote !== undefined && quote !== 0 ? (quote - strike) / quote : null;
  const spread = quote !== null && quote !== undefined ? round2(quote - strike) : null;
  const guarantee = round2(strike * op.quantity);
  const cash = op.committed_capital;
  const hasCoverage = cash !== null && cash !== undefined ? cash >= guarantee : null;
  const rate = strike > 0 ? premium / strike : 0;

  const totalPremium = round2(op.premium_received);
  const buybackPerShare = op.buyback_premium;
  const totalBuyback =
    buybackPerShare !== null && buybackPerShare !== undefined ? round2(buybackPerShare * op.quantity) : null;
  const sellMinusBuyback = totalBuyback !== null ? round2(totalPremium - totalBuyback) : null;

  let ir: number | null;
  let netProfit: number | null;
  let efficiency: number | null;
  let isEstimate = false;

  if (op.status === 'aberta') {
    if (totalBuyback !== null) {
      const live = calculateNetProfit({ optionType: 'PUT', premiumReceived: totalPremium, buybackCost: totalBuyback, irFrozen });
      ir = round2(live.ir);
      netProfit = round2(live.netProfit);
      efficiency = round2(live.efficiencyPct);
    } else {
      const estimated = calculateNetProfit({ optionType: 'PUT', premiumReceived: totalPremium, buybackCost: 0, irFrozen });
      ir = round2(estimated.ir);
      netProfit = round2(estimated.netProfit);
      efficiency = round2(estimated.efficiencyPct);
      isEstimate = true;
    }
  } else {
    ir = op.ir_amount ?? null;
    netProfit = op.net_profit ?? null;
    efficiency = op.efficiency_pct ?? null;
  }

  return {
    quote, strike, premium, ceiling, isExpensive, distance, spread, guarantee, cash, hasCoverage, rate,
    totalPremium, buybackPerShare, totalBuyback, sellMinusBuyback, ir, netProfit, efficiency, isEstimate,
  };
}

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
        'rounded border px-1.5 py-1 text-center text-[11.5px] outline-none',
        mono && 'font-tabular',
        danger ? 'border-danger/60 bg-danger-muted text-danger' : 'border-border bg-surface-elevated text-foreground'
      )}
    />
  );
}

export function PutOperationsTable({ operations, withdrawalsByOperation, irFrozen, onChanged, onClose }: PutOperationsTableProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastAutoFetchedTicker = useRef<Record<string, string>>({});
  const operationsRef = useRef(operations);
  useEffect(() => {
    operationsRef.current = operations;
  }, [operations]);

  function currentOp(id: string): Operation | undefined {
    return operationsRef.current.find((o) => o.id === id);
  }

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
            <Th width={90}>Semana</Th>
            <Th width={100}>Data</Th>
            <Th width={78}>Ativo</Th>
            <Th width={90}>Ticker</Th>
            <Th width={92}>Cotação</Th>
            <Th>Será Exercido?</Th>
            <Th width={70}>Qnt</Th>
            <Th width={80}>Prêmio Venda</Th>
            <Th>Total Prêmio</Th>
            <Th width={80}>Strike</Th>
            <Th>Distância do strike</Th>
            <Th width={144}>Risco</Th>
            <Th width={100}>Recomendação</Th>
            <Th width={130}>Teto</Th>
            <Th>Spread</Th>
            <Th>Garantia</Th>
            <Th width={100}>Caixa</Th>
            <Th>Tem Cobertura?</Th>
            <Th>Taxa (%)</Th>
            <Th>Vencimento</Th>
            <Th width={90}>Valor Recompra</Th>
            <Th>Total Recompra</Th>
            <Th>Venda-Recompra</Th>
            <Th>IR (15%)</Th>
            <Th>Lucro Final</Th>
            <Th>Eficiência (%)</Th>
            <Th width={90}>Prejuízo</Th>
            <Th width={100}>Exercido?</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => {
            const r = calcPutRow(op, irFrozen);
            const editable = op.status === 'aberta';
            return (
              <tr key={op.id} className={cn('border-t border-glass-border transition-colors hover:bg-white/[0.03]', !editable && 'opacity-60 hover:opacity-100')}>
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

                <Td width={100}>
                  {editable ? (
                    <DatePickerField value={op.opened_at?.slice(0, 10) ?? null} onSelect={(date) => saveField(op, { opened_at: date })} />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.opened_at)}</span>
                  )}
                </Td>

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

                <Td width={92}>
                  {editable ? (
                    <div className="flex items-center justify-center gap-1">
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

                <Td>
                  {!editable ? (
                    op.exercised_label ? (
                      <Badge variant={op.exercised_label === 'Sim' ? 'danger' : op.exercised_label === 'Rolagem' ? 'warning' : 'success'}>
                        {op.exercised_label === 'Sim' ? 'Exercido' : op.exercised_label}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-faint-foreground">—</span>
                    )
                  ) : r.quote !== null && r.quote !== undefined ? (
                    (() => {
                      const rec = computeRollRecommendation(r.strike, r.quote, 'PUT');
                      if (rec.level === 'unknown') return <span className="text-[11px] text-faint-foreground">—</span>;
                      const badgeVariant = rec.level === 'roll' ? 'danger' : rec.level === 'watch' ? 'warning' : 'success';
                      const label = rec.level === 'roll' ? 'Provável' : rec.level === 'watch' ? 'Atenção' : 'Improvável';
                      return <Badge variant={badgeVariant}>{label}</Badge>;
                    })()
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>

                <Td width={70}>
                  {editable ? (
                    <InlineField
                      key={`qty-${op.id}-${op.quantity}`}
                      initialValue={String(op.quantity)}
                      onCommit={(v) => {
                        const latest = currentOp(op.id) ?? op;
                        const newQty = Math.round(parseBRNumber(v));
                        const perShare = latest.quantity > 0 ? latest.premium_received / latest.quantity : 0;
                        saveField(latest, { quantity: newQty, premium_received: round4(perShare * newQty) });
                      }}
                      placeholder="0"
                      width={56}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] text-muted-foreground">{op.quantity.toLocaleString('pt-BR')}</span>
                  )}
                </Td>

                <Td width={80}>
                  {editable ? (
                    <InlineField
                      key={`premium-${op.id}-${r.premium}`}
                      initialValue={formatPreciseNumber(r.premium)}
                      onCommit={(v) => {
                        const latest = currentOp(op.id) ?? op;
                        saveField(latest, { premium_received: parseBRNumber(v) * latest.quantity });
                      }}
                      placeholder="0,00"
                      width={56}
                    />
                  ) : (
                    <span className="font-tabular text-[11.5px] font-semibold text-accent">{formatNumber(r.premium, 2)}</span>
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
                    <span className={cn('font-tabular text-[11.5px] font-semibold', r.isExpensive ? 'text-danger' : 'text-accent')}>
                      {formatNumber(r.strike, 2)}
                    </span>
                  )}
                </Td>

                <Td>
                  <span className="font-tabular text-[11.5px] text-muted-foreground">
                    {r.distance !== null ? formatPct(r.distance * 100, 2) : '—'}
                  </span>
                </Td>

                <Td width={144}>
                  <ExerciseRiskGauge strike={r.strike} quote={r.quote} optionType="PUT" />
                </Td>

                <Td width={100}>
                  <RiskGaugeSpeedometer recommendation={computeRollRecommendation(r.strike, r.quote, 'PUT')} />
                </Td>

                <Td width={130}>
                  <div className="flex items-center justify-center gap-1.5">
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
                  <span className="font-tabular text-[11.5px] text-muted-foreground">{r.spread !== null ? formatNumber(r.spread, 2) : '—'}</span>
                </Td>

                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{formatBRL(r.guarantee)}</span>
                </Td>

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

                <Td>
                  {r.hasCoverage !== null ? (
                    <Badge variant={r.hasCoverage ? 'success' : 'danger'}>{r.hasCoverage ? 'Tem' : 'Não'}</Badge>
                  ) : (
                    <span className="text-[11px] text-faint-foreground">—</span>
                  )}
                </Td>

                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{formatPct(r.rate * 100, 2)}</span>
                </Td>

                <Td>
                  <span className="font-tabular text-[11.5px] text-muted-foreground">{formatDate(op.expiration)}</span>
                </Td>

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

                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.totalBuyback !== null ? formatBRL(r.totalBuyback) : '—'}</span>
                </Td>

                <Td>
                  <span className="font-tabular text-[11.5px] text-accent">{r.sellMinusBuyback !== null ? formatBRL(r.sellMinusBuyback) : '—'}</span>
                </Td>

                <Td>
                  {r.ir !== null ? (
                    <span
                      className={cn('font-tabular text-[11.5px] text-danger', r.isEstimate && 'italic opacity-70')}
                      title={r.isEstimate ? 'Projeção — assume expiração sem custo de recompra. Preencha o Valor Recompra para o cálculo real.' : undefined}
                    >
                      {formatBRL(r.ir)}
                      {r.isEstimate && '*'}
                    </span>
                  ) : (
                    <span className="font-tabular text-[11.5px] text-danger">—</span>
                  )}
                </Td>

                <Td>
                  {r.netProfit !== null ? (
                    <span
                      className={cn('font-tabular text-[11.5px] font-bold text-accent', r.isEstimate && 'italic opacity-70')}
                      title={r.isEstimate ? 'Projeção — assume expiração sem custo de recompra. Preencha o Valor Recompra para o cálculo real.' : undefined}
                    >
                      {formatBRL(r.netProfit)}
                      {r.isEstimate && '*'}
                    </span>
                  ) : (
                    <span className="font-tabular text-[11.5px] font-bold text-accent">—</span>
                  )}
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
                      'w-full rounded border px-1.5 py-1 text-center text-[11px] outline-none',
                      op.exercised_label
                        ? 'border-border bg-transparent text-foreground'
                        : 'border-border bg-surface-elevated text-faint-foreground'
                    )}
                  >
                    <option value="">—</option>
                    <option value="Sim">Exercido</option>
                    <option value="Não">Não</option>
                    <option value="Rolagem">Rolagem</option>
                  </select>
                </Td>

                <Td>
                  <div className="flex items-center justify-center gap-1.5">
                    {editable && (
                      <button
                        onClick={() => onClose(op)}
                        className="whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-surface-hover"
                      >
                        Encerrar
                      </button>
                    )}
                    {!editable && (
                      <button
                        onClick={() => handleToggleWithdrawal(op)}
                        title={withdrawalsByOperation[op.id] ? 'Marcado como sacado — clique para desmarcar' : 'Marcar prêmio desta operação como sacado'}
                        className={cn(
                          'flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] font-medium',
                          withdrawalsByOperation[op.id]
                            ? 'border-warning/40 bg-warning-muted text-warning'
                            : 'border-border bg-surface-elevated text-foreground hover:bg-surface-hover'
                        )}
                      >
                        <Wallet className="h-3 w-3" />
                        {withdrawalsByOperation[op.id] ? 'Sacado' : 'Sacar'}
                      </button>
                    )}
                    {!editable && (
                      <button
                        onClick={() => handleToggleEquityImpact(op)}
                        title={
                          op.counts_toward_equity
                            ? 'Conta no cálculo de Patrimônio — clique para marcar como histórico (não conta de novo)'
                            : 'Marcada como histórico — não conta no cálculo de Patrimônio (mas conta no Aprendizado)'
                        }
                        className={cn(
                          'flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] font-medium',
                          !op.counts_toward_equity
                            ? 'border-info/40 bg-info/10 text-info'
                            : 'border-border bg-surface-elevated text-faint-foreground hover:bg-surface-hover'
                        )}
                      >
                        <History className="h-3 w-3" />
                        {op.counts_toward_equity ? 'Conta' : 'Histórico'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(op)}
                      title="Excluir operação"
                      className="text-faint-foreground hover:text-danger"
                    >
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

function Th({ children, width }: { children?: React.ReactNode; width?: number }) {
  return (
    <th
      className="whitespace-nowrap border-b border-glass-border bg-white/[0.03] px-1.5 pb-2 pt-1.5 text-center text-[9.5px] font-bold uppercase tracking-wider text-faint-foreground"
      style={{ width }}
    >
      {children}
    </th>
  );
}

function Td({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <td className="px-1.5 py-1 text-center align-middle" style={{ width }}>
      {children}
    </td>
  );
}
