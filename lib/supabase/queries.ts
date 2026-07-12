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
  opportunityId: string | null;
  optionType: 'PUT' | 'CALL';
  strike: number;
  expiration: string;
  quantity: number;
  premiumReceived: number;
  deltaAtOpen: number | null;
  committedCapital: number | null;
  notes?: string | null;
}

export async function createOperation(input: NewOperationInput): Promise<Operation> {
  const { data, error } = await supabase
    .from('operations')
    .insert({
      asset_id: input.assetId,
      opportunity_id: input.opportunityId,
      option_type: input.optionType,
      strike: input.strike,
      expiration: input.expiration,
      quantity: input.quantity,
      premium_received: input.premiumReceived,
      delta_at_open: input.deltaAtOpen,
      committed_capital: input.committedCapital,
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
    .select('*, asset:assets(*)')
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
// Equity snapshots
// ---------------------------------------------------------------
export async function upsertTodayEquitySnapshot(values: {
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
      total_equity: values.totalEquity,
      free_cash: values.freeCash,
      committed_capital: values.committedCapital,
      cumulative_premiums: values.cumulativePremiums,
      cumulative_profit: values.cumulativeProfit,
    },
    { onConflict: 'recorded_at' }
  );
  if (error) throw error;
}
