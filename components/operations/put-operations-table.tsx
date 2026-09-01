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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

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
      onFocus={(e) => e.target.select()}
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
                  <Badge variant={op.status
