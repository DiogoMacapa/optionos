// ============================================================
// OptionOS — Tipos de domínio (espelham o schema do Supabase)
// ============================================================

export type OptionType = 'PUT' | 'CALL';
export type OperationStatus = 'aberta' | 'encerrada' | 'rolada' | 'exercida';
export type OpportunityStatus = 'ativa' | 'expirada' | 'convertida' | 'descartada';
export type Trend = 'alta' | 'baixa' | 'lateral';
export type SnapshotSource = 'investing' | 'btg' | 'manual';

export interface Asset {
  id: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  active: boolean;
  created_at: string;
}

export interface MarketSnapshot {
  id: string;
  asset_id: string;
  captured_at: string;
  source: SnapshotSource;

  last_price: number | null;
  change_abs: number | null;
  change_pct: number | null;

  day_low: number | null;
  day_high: number | null;
  week52_low: number | null;
  week52_high: number | null;

  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  close_price: number | null;

  volume: number | null;
  ema9: number | null;
  ema21: number | null;
  sma50: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  rsi14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;

  trend: Trend | null;

  source_image_ref: string | null;
  ocr_confidence: number | null;
  raw_ocr_text: string | null;
  manually_confirmed: boolean;

  created_at: string;
}

export interface OptionChainEntry {
  id: string;
  asset_id: string;
  snapshot_id: string | null;

  option_type: OptionType;
  strike: number;
  expiration: string;

  premium: number;
  bid: number | null;
  ask: number | null;
  delta: number | null;
  implied_volatility: number | null;
  open_interest: number | null;
  daily_volume: number | null;

  captured_at: string;
  source_image_ref: string | null;
  ocr_confidence: number | null;
  raw_ocr_text: string | null;
  manually_confirmed: boolean;

  created_at: string;
}

export interface ScoreWeights {
  id: string;
  name: string;
  is_active: boolean;
  weight_delta: number;
  weight_premium: number;
  weight_strike_distance: number;
  weight_liquidity: number;
  weight_spread: number;
  weight_history: number;
  created_at: string;
  updated_at: string;
}

export interface StrategySettings {
  id: string;
  max_delta: number;
  min_delta: number;
  available_cash: number | null;
  max_concentration_pct: number | null;
  min_days_to_expiration: number | null;
  max_days_to_expiration: number | null;
  preferred_otm_only: boolean;
  updated_at: string;
}

export interface ScoreBreakdown {
  delta_score: number;
  premium_score: number;
  strike_distance_score: number;
  liquidity_score: number;
  spread_score: number;
  history_score: number;
}

export interface Opportunity {
  id: string;
  option_chain_entry_id: string;
  asset_id: string;
  score: number;
  stars: number;
  efficiency_pct: number;
  score_breakdown: ScoreBreakdown | null;
  weights_used_id: string | null;
  status: OpportunityStatus;
  created_at: string;

  // Joins opcionais (preenchidos em queries compostas)
  asset?: Asset;
  option_chain_entry?: OptionChainEntry;
}

export interface Operation {
  id: string;
  asset_id: string;
  opportunity_id: string | null;

  option_type: OptionType;
  strike: number;
  expiration: string;
  quantity: number;

  premium_received: number;
  delta_at_open: number | null;

  committed_capital: number | null;

  status: OperationStatus;

  closed_at: string | null;
  close_price: number | null;
  net_profit: number | null;
  ir_amount: number | null;

  rolled_to_operation_id: string | null;
  rolled_from_operation_id: string | null;

  exercised: boolean;

  opened_at: string;
  notes: string | null;

  created_at: string;
  updated_at: string;

  // Join opcional
  asset?: Asset;
}

export interface EquitySnapshot {
  id: string;
  recorded_at: string;
  total_equity: number;
  free_cash: number;
  committed_capital: number;
  cumulative_premiums: number;
  cumulative_profit: number;
  created_at: string;
}
