import { supabase } from '@/lib/supabase/client';
import type {
  Asset,
  MarketSnapshot,
  OptionChainEntry,
  Opportunity,
  Operation,
  ScoreWeights,
  StrategySettings,
  ScoreBreakdown,
  Holder,
  StockPosition,
  Withdrawal,
  NamedStrategy,
  EquitySnapshot,
  CommissionSummary,
  CalculatorRow,
  CalculatorSettings,
} from '@/lib/types/database';

// ---------------------------------------------------------------
// Assets
// ---------------------------------------------------------------
export async function listAssets(): Promise<Asset[]> {
  const { data, error } = await supabase.from('assets').select('*').order('ticker');
  if (error) throw error;
  return data ?? [];
}

export async function findOrCreateAsset(ticker: string): Promise<Asset> {
  const clean = ticker.trim().toUpperCase();
  const { data: existing } = await supabase.from('assets').select('*').eq('ticker', clean).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase.from('assets').insert({ ticker: clean }).select('*').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// Market snapshots (gráfico)
// ---------------------------------------------------------------
export interface NewSnapshotInput {
  assetId: string;
  source: MarketSnapshot['source'];
  values: Partial<
    Pick<
      MarketSnapshot,
      | 'last_price'
      | 'change_abs'
      | 'change_pct'
      | 'day_low'
      | 'day_high'
      | 'week52_low'
      | 'week52_high'
      | 'open_price'
      | 'high_price'
      | 'low_price'
      | 'close_price'
      | 'bb_upper'
      | 'bb_middle'
      | 'bb_lower'
      | 'rsi14'
      | 'macd_line'
      | 'macd_signal'
      | 'macd_histogram'
      | 'trend'
    >
  >;
  ocrConfidence?: number | null;
  rawOcrText?: string | null;
  manuallyConfirmed: boolean;
}

export async function createMarketSnapshot(input: NewSnapshotInput): Promise<MarketSnapshot> {
  const { data, error } = await supabase
    .from('market_snapshots')
    .insert({
      asset_id: input.assetId,
      source: input.source,
      ...input.values,
      ocr_confidence: input.ocrConfidence ?? null,
      raw_ocr_text: input.rawOcrText ?? null,
      manually_confirmed: input.manuallyConfirmed,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function latestSnapshotForAsset(assetId: string): Promise<MarketSnapshot | null> {
  const { data, error } = await supabase
    .from('market_snapshots')
    .select('*')
    .eq('asset_id', assetId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// Option chain (book de opções)
// ---------------------------------------------------------------
export interface NewOptionChainRowInput {
  assetId: string;
  snapshotId: string | null;
  optionType: 'PUT' | 'CALL';
  strike: number;
  expiration: string;
  premium: number;
  bid: number | null;
  ask: number | null;
  delta: number | null;
  openInterest: number | null;
  dailyVolume: number | null;
  ocrConfidence: number | null;
  manuallyConfirmed: boolean;
}

export async function insertOptionChainRows(rows: NewOptionChainRowInput[]): Promise<OptionChainEntry[]> {
  const payload = rows.map((r) => ({
    asset_id: r.assetId,
    snapshot_id: r.snapshotId,
    option_type: r.optionType,
    strike: r.strike,
    expiration: r.expiration,
    premium: r.premium,
    bid: r.bid,
    ask: r.ask,
    delta: r.delta,
    open_interest: r.openInterest,
    daily_volume: r.dailyVolume,
    ocr_confidence: r.ocrConfidence,
    manually_confirmed: r.manuallyConfirmed,
  }));
  const { data, error } = await supabase.from('option_chain_entries').insert(payload).select('*');
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------
// Score weights / strategy settings
// ---------------------------------------------------------------
export async function getActiveScoreWeights(): Promise<ScoreWeights> {
  const { data, error } = await supabase.from('score_weights').select('*').eq('is_active', true).limit(1).single();
  if (error) throw error;
  return data;
}

export async function updateScoreWeights(id: string, patch: Partial<ScoreWeights>): Promise<ScoreWeights> {
  const { data, error } = await supabase.from('score_weights').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function getStrategySettings(): Promise<StrategySettings> {
  const { data, error } = await supabase.from('strategy_settings').select('*').limit(1).single();
  if (error) throw error;
  return data;
}

export async function updateStrategySettings(id: string, patch: Partial<StrategySettings>): Promise<StrategySettings> {
  const { data, error } = await supabase.from('strategy_settings').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------
export interface NewOpportunityInput {
  optionChainEntryId: string;
  assetId: string;
  score: number;
  stars: number;
  efficiencyPct: number;
  breakdown: ScoreBreakdown;
  weightsUsedId: string;
}

export async function createOpportunity(input: NewOpportunityInput): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      option_chain_entry_id: input.optionChainEntryId,
      asset_id: input.assetId,
      score: input.score,
      stars: input.stars,
      efficiency_pct: input.efficiencyPct,
      score_breakdown: input.breakdown,
      weights_used_id: input.weightsUsedId,
      status: 'ativa',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listActiveOpportunities(): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*, asset:assets(*), option_chain_entry:option_chain_entries(*)')
    .eq('status', 'ativa')
    .order('score', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Opportunity[];
}

export async function discardOpportunity(id: string): Promise<void> {
  const { error } = await supabase.from('opportunities').update({ status: 'descartada' }).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------
// Operations
// ---------------------------------------------------------------
export interface NewOperationInput {
  assetId: string;
  holderId: string;
  opportunityId: string | null;
  optionType: 'PUT' | 'CALL';
  strike: number;
  expiration: string;
  quantity: number;
  premiumReceived: number;
  deltaAtOpen: number | null;
  committedCapital: number | null;
  stockPositionId?: string | null;
  notes?: string | null;
}

export async function createOperation(input: NewOperationInput): Promise<Operation> {
  const { data, error } = await supabase
    .from('operations')
    .insert({
      asset_id: input.assetId,
      holder_id: input.holderId,
      opportunity_id: input.opportunityId,
      option_type: input.optionType,
      strike: input.strike,
      expiration: input.expiration,
      quantity: input.quantity,
      premium_received: input.premiumReceived,
      delta_at_open: input.deltaAtOpen,
      committed_capital: input.committedCapital,
      stock_position_id: input.stockPositionId ?? null,
      status: 'aberta',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listOperations(): Promise<Operation[]> {
  const { data, error } = await supabase
    .from('operations')
    .select('*, asset:assets(*), holder:holders(*)')
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Operation[];
}

export interface CloseOperationInput {
  id: string;
  status: 'encerrada' | 'exercida';
  closePrice: number;
  netProfit: number;
  irAmount: number;
  exercised: boolean;
  grossResult?: number;
  irBase?: number;
  efficiencyPct?: number;
  commissionAmount?: number;
}

export async function closeOperation(input: CloseOperationInput): Promise<Operation> {
  const { data, error } = await supabase
    .from('operations')
    .update({
      status: input.status,
      closed_at: new Date().toISOString(),
      close_price: input.closePrice,
      net_profit: input.netProfit,
      ir_amount: input.irAmount,
      exercised: input.exercised,
      gross_result: input.grossResult ?? null,
      ir_base: input.irBase ?? null,
      efficiency_pct: input.efficiencyPct ?? null,
      commission_amount: input.commissionAmount ?? 0,
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export interface RollOperationInput {
  originalId: string;
  newOperation: NewOperationInput;
  buybackCost: number;
}

/** Rola uma operação: encerra a original (custo = recompra) e abre uma nova ligada a ela. */
export async function rollOperation(input: RollOperationInput): Promise<{ closed: Operation; opened: Operation }> {
  const net = -input.buybackCost; // custo de recompra é saída de caixa nesta perna
  const closed = await closeOperationRolled(input.originalId, input.buybackCost, net);
  const opened = await createOperation(input.newOperation);

  const { error: linkError } = await supabase
    .from('operations')
    .update({ rolled_to_operation_id: opened.id })
    .eq('id', closed.id);
  if (linkError) throw linkError;

  const { error: linkBackError } = await supabase
    .from('operations')
    .update({ rolled_from_operation_id: closed.id })
    .eq('id', opened.id);
  if (linkBackError) throw linkBackError;

  return { closed, opened };
}

async function closeOperationRolled(id: string, buybackCost: number, netProfit: number): Promise<Operation> {
  const { data, error } = await supabase
    .from('operations')
    .update({
      status: 'rolada',
      closed_at: new Date().toISOString(),
      close_price: buybackCost,
      net_profit: netProfit,
      ir_amount: 0,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// Equity snapshots (por titular)
// ---------------------------------------------------------------
export async function upsertTodayEquitySnapshot(values: {
  holderId: string;
  totalEquity: number;
  freeCash: number;
  committedCapital: number;
  cumulativePremiums: number;
  cumulativeProfit: number;
}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('equity_snapshots').upsert(
    {
      recorded_at: today,
      holder_id: values.holderId,
      total_equity: values.totalEquity,
      free_cash: values.freeCash,
      committed_capital: values.committedCapital,
      cumulative_premiums: values.cumulativePremiums,
      cumulative_profit: values.cumulativeProfit,
    },
    { onConflict: 'holder_id,recorded_at' }
  );
  if (error) throw error;
}

export async function listEquitySnapshots(holderId?: string): Promise<EquitySnapshot[]> {
  let query = supabase.from('equity_snapshots').select('*').order('recorded_at', { ascending: true });
  if (holderId) query = query.eq('holder_id', holderId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCommissionSummary(): Promise<CommissionSummary[]> {
  const { data, error } = await supabase.from('commission_summary').select('*');
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------
// Holders (titulares — Diogo, Mãe, ...)
// ---------------------------------------------------------------
export async function listHolders(): Promise<Holder[]> {
  const { data, error } = await supabase.from('holders').select('*').eq('active', true).order('is_self', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSelfHolder(): Promise<Holder> {
  const { data, error } = await supabase.from('holders').select('*').eq('is_self', true).limit(1).single();
  if (error) throw error;
  return data;
}

export async function createHolder(input: { name: string; commissionPct: number }): Promise<Holder> {
  const { data, error } = await supabase
    .from('holders')
    .insert({ name: input.name, is_self: false, commission_pct: input.commissionPct })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateHolder(id: string, patch: Partial<Pick<Holder, 'name' | 'commission_pct' | 'active'>>): Promise<Holder> {
  const { data, error } = await supabase.from('holders').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// Stock positions (PM para Covered Call)
// ---------------------------------------------------------------
export async function listStockPositions(holderId?: string): Promise<StockPosition[]> {
  let query = supabase.from('stock_positions').select('*, asset:assets(*), holder:holders(*)').eq('active', true);
  if (holderId) query = query.eq('holder_id', holderId);
  const { data, error } = await query.order('opened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as StockPosition[];
}

export async function getStockPosition(assetId: string, holderId: string): Promise<StockPosition | null> {
  const { data, error } = await supabase
    .from('stock_positions')
    .select('*')
    .eq('asset_id', assetId)
    .eq('holder_id', holderId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertStockPosition(input: {
  assetId: string;
  holderId: string;
  quantity: number;
  averagePrice: number;
}): Promise<StockPosition> {
  const existing = await getStockPosition(input.assetId, input.holderId);
  if (existing) {
    const { data, error } = await supabase
      .from('stock_positions')
      .update({ quantity: input.quantity, average_price: input.averagePrice })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('stock_positions')
    .insert({
      asset_id: input.assetId,
      holder_id: input.holderId,
      quantity: input.quantity,
      average_price: input.averagePrice,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function closeStockPosition(id: string): Promise<void> {
  const { error } = await supabase
    .from('stock_positions')
    .update({ active: false, closed_at: new Date().toISOString().slice(0, 10) })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------
// Withdrawals (saques — lançamento manual, nunca fórmula fixa)
// ---------------------------------------------------------------
export async function listWithdrawals(holderId?: string): Promise<Withdrawal[]> {
  let query = supabase.from('withdrawals').select('*, holder:holders(*)');
  if (holderId) query = query.eq('holder_id', holderId);
  const { data, error } = await query.order('withdrawn_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Withdrawal[];
}

export async function createWithdrawal(input: {
  holderId: string;
  operationId?: string | null;
  amount: number;
  withdrawnAt?: string;
  notes?: string | null;
}): Promise<Withdrawal> {
  const { data, error } = await supabase
    .from('withdrawals')
    .insert({
      holder_id: input.holderId,
      operation_id: input.operationId ?? null,
      amount: input.amount,
      withdrawn_at: input.withdrawnAt ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
// Named strategies (glossário de táticas, para contexto de IA)
// ---------------------------------------------------------------
export async function listNamedStrategies(): Promise<NamedStrategy[]> {
  const { data, error } = await supabase.from('named_strategies').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------
// Calculator rows & settings (substitui localStorage — sincroniza
// entre dispositivos e sobrevive a limpar dados do navegador)
// ---------------------------------------------------------------
export async function listCalculatorRows(): Promise<CalculatorRow[]> {
  const { data, error } = await supabase.from('calculator_rows').select('*').order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCalculatorRow(position: number): Promise<CalculatorRow> {
  const { data, error } = await supabase
    .from('calculator_rows')
    .insert({ position, ticker: '', quote: '', strike: '', ceiling: '', premium: '' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCalculatorRow(
  id: string,
  patch: Partial<Pick<CalculatorRow, 'ticker' | 'quote' | 'strike' | 'ceiling' | 'premium' | 'position'>>
): Promise<CalculatorRow> {
  const { data, error } = await supabase.from('calculator_rows').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCalculatorRow(id: string): Promise<void> {
  const { error } = await supabase.from('calculator_rows').delete().eq('id', id);
  if (error) throw error;
}

export async function getCalculatorSettings(): Promise<CalculatorSettings> {
  const { data, error } = await supabase.from('calculator_settings').select('*').limit(1).single();
  if (error) throw error;
  return data;
}

export async function updateCalculatorSettings(id: string, cash: string): Promise<CalculatorSettings> {
  const { data, error } = await supabase.from('calculator_settings').update({ cash }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}
