import type {
  OptionChainEntry,
  ScoreWeights,
  StrategySettings,
  ScoreBreakdown,
} from '@/lib/types/database';

/**
 * Motor de Score do OptionOS.
 *
 * Filosofia: cada componente é normalizado para uma escala 0–100 ANTES
 * de aplicar o peso. Isso torna os pesos comparáveis entre si e fáceis
 * de ajustar sem reescrever a lógica de cada componente.
 *
 * Todos os componentes assumem "quanto maior, melhor" após normalização,
 * mesmo quando a métrica bruta é "quanto menor, melhor" (ex: spread).
 */

export interface ScoringInput {
  entry: OptionChainEntry;
  currentPrice: number;
  weights: ScoreWeights;
  settings: StrategySettings;
  /** Taxa de sucesso histórica (0-1) para este ativo/delta, se houver dados suficientes. */
  historicalSuccessRate?: number | null;
}

export interface ScoringResult {
  score: number;           // 0-100
  stars: number;           // 0-5, em passos de 0.5
  efficiencyPct: number;   // 0-100
  breakdown: ScoreBreakdown;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Score de Delta: quanto mais próximo do delta "ideal" (metade do máximo
 * configurado), melhor. Deltas muito baixos = prêmio desprezível;
 * deltas acima do máximo = risco de exercício alto demais.
 */
function scoreDelta(delta: number | null, settings: StrategySettings): number {
  if (delta === null) return 0;
  const absDelta = Math.abs(delta);
  const { min_delta, max_delta } = settings;

  if (absDelta > max_delta * 1.15) return 0; // muito acima do teto, mesmo com tolerância
  if (absDelta > max_delta) {
    // Levemente acima do máximo: penaliza mas não zera (regra do usuário:
    // aceita operar acima do máximo se a probabilidade de exercício for baixa).
    const overshoot = (absDelta - max_delta) / (max_delta * 0.15);
    return clamp(60 * (1 - overshoot), 0, 60);
  }
  if (absDelta < min_delta) {
    const factor = absDelta / min_delta;
    return clamp(40 * factor, 0, 40);
  }

  // Dentro da faixa ideal: pico no meio do intervalo [min_delta, max_delta]
  const mid = (min_delta + max_delta) / 2;
  const range = (max_delta - min_delta) / 2 || 1;
  const distFromMid = Math.abs(absDelta - mid) / range;
  return clamp(100 * (1 - distFromMid * 0.5), 50, 100);
}

/**
 * Score de Prêmio: relativo ao capital comprometido (yield da operação).
 * Prêmio absoluto não diz nada sozinho — o que importa é o retorno %.
 */
function scorePremium(entry: OptionChainEntry): number {
  const committedCapital = entry.strike * 100; // por contrato
  if (committedCapital <= 0) return 0;
  const yieldPct = (entry.premium * 100) / committedCapital;

  // Referência: 0.3% ao dia é excelente para operações semanais (~1.5-2%/semana)
  const dte = daysToExpiration(entry.expiration);
  const dailyYield = dte > 0 ? yieldPct / dte : yieldPct;

  // 0.15%/dia = score baixo, 0.35%/dia = score máximo
  return clamp(((dailyYield - 0.05) / 0.35) * 100, 0, 100);
}

/**
 * Score de Distância do Strike: quanto mais OTM (fora do dinheiro),
 * menor o risco de exercício, mas também menor o prêmio — o score
 * pondera para recompensar distância sem penalizar prêmios competitivos demais.
 */
function scoreStrikeDistance(entry: OptionChainEntry, currentPrice: number): number {
  if (currentPrice <= 0) return 0;
  const distPct =
    entry.option_type === 'PUT'
      ? ((currentPrice - entry.strike) / currentPrice) * 100
      : ((entry.strike - currentPrice) / currentPrice) * 100;

  if (distPct < 0) return 10; // ITM: risco alto de exercício, score baixo mas não zero
  // 1% de distância = score baixo, 8%+ = score máximo
  return clamp((distPct / 8) * 100, 0, 100);
}

/**
 * Score de Liquidez: baseado em volume diário e open interest.
 */
function scoreLiquidity(entry: OptionChainEntry): number {
  const volume = entry.daily_volume ?? 0;
  const oi = entry.open_interest ?? 0;

  // Referências conservadoras para opções de blue chips brasileiras
  const volumeScore = clamp((volume / 500) * 100, 0, 100);
  const oiScore = clamp((oi / 2000) * 100, 0, 100);

  return volumeScore * 0.6 + oiScore * 0.4;
}

/**
 * Score de Spread: bid-ask apertado é melhor (menor custo de entrada/saída).
 */
function scoreSpread(entry: OptionChainEntry): number {
  if (entry.bid === null || entry.ask === null || entry.bid <= 0) return 50; // sem dado, neutro
  const spreadPct = ((entry.ask - entry.bid) / entry.bid) * 100;

  // 2% de spread = score máximo, 20%+ = score mínimo
  return clamp(100 - ((spreadPct - 2) / 18) * 100, 0, 100);
}

/**
 * Score de Histórico: baseado na taxa de sucesso passada para
 * ativo/delta similares. Sem dados suficientes, retorna neutro (50).
 */
function scoreHistory(historicalSuccessRate: number | null | undefined): number {
  if (historicalSuccessRate === null || historicalSuccessRate === undefined) return 50;
  return clamp(historicalSuccessRate * 100, 0, 100);
}

function daysToExpiration(expiration: string): number {
  const exp = new Date(expiration + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = exp.getTime() - today.getTime();
  return Math.max(1, Math.round(diffMs / 86400000));
}

export function calculateScore(input: ScoringInput): ScoringResult {
  const { entry, currentPrice, weights, settings, historicalSuccessRate } = input;

  const breakdown: ScoreBreakdown = {
    delta_score: scoreDelta(entry.delta, settings),
    premium_score: scorePremium(entry),
    strike_distance_score: scoreStrikeDistance(entry, currentPrice),
    liquidity_score: scoreLiquidity(entry),
    spread_score: scoreSpread(entry),
    history_score: scoreHistory(historicalSuccessRate),
  };

  const rawScore =
    breakdown.delta_score * weights.weight_delta +
    breakdown.premium_score * weights.weight_premium +
    breakdown.strike_distance_score * weights.weight_strike_distance +
    breakdown.liquidity_score * weights.weight_liquidity +
    breakdown.spread_score * weights.weight_spread +
    breakdown.history_score * weights.weight_history;

  const totalWeight =
    weights.weight_delta +
    weights.weight_premium +
    weights.weight_strike_distance +
    weights.weight_liquidity +
    weights.weight_spread +
    weights.weight_history;

  const score = clamp(rawScore / (totalWeight || 1), 0, 100);
  const stars = Math.round((score / 100) * 5 * 2) / 2; // passos de 0.5
  const efficiencyPct = Math.round(score * 10) / 10;

  return {
    score: Math.round(score * 10) / 10,
    stars,
    efficiencyPct,
    breakdown,
  };
}

export function efficiencyLabel(pct: number): { label: string; color: 'green' | 'yellow' | 'red' } {
  if (pct >= 85) return { label: 'Excelente', color: 'green' };
  if (pct >= 70) return { label: 'Boa', color: 'green' };
  if (pct >= 55) return { label: 'Regular', color: 'yellow' };
  return { label: 'Ruim', color: 'red' };
}
