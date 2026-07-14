// ============================================================
// OptionOS — Calculadoras financeiras
//
// IMPORTANTE: aqui "quantidade" é sempre o número de AÇÕES,
// exatamente como na planilha real do usuário (coluna "Qnt":
// 33800, 9100, etc.) — não é número de contratos de 100 ações.
// Nunca multiplicar por um tamanho de lote ao calcular capital.
//
// Porém: na B3, ações só operam em lote-padrão de 100 (exceto
// mercado fracionário, que não é o caso de venda coberta). Por
// isso a quantidade MÁXIMA calculada a partir do caixa precisa
// ser arredondada para baixo até o múltiplo de 100 mais próximo.
// ============================================================

const ROUND_LOT = 100;

export interface MaxContractsInput {
  availableCash: number;
  strike: number;
}

export function calculateMaxContracts({ availableCash, strike }: MaxContractsInput): number {
  if (strike <= 0) return 0;
  const rawQuantity = Math.floor(availableCash / strike);
  return Math.floor(rawQuantity / ROUND_LOT) * ROUND_LOT;
}

export interface RequiredCapitalInput {
  strike: number;
  quantity: number;
}

export function calculateRequiredCapital({ strike, quantity }: RequiredCapitalInput): number {
  return strike * quantity;
}

export interface ExpectedPremiumInput {
  premium: number;
  quantity: number;
}

export function calculateExpectedPremium({ premium, quantity }: ExpectedPremiumInput): number {
  return premium * quantity;
}

/**
 * IR sobre operações de opções no Brasil: 15% sobre renda variável comum.
 * Isenção de R$20.000/mês em vendas de ações NÃO se aplica a opções.
 *
 * Regra fiscal validada com dados reais da planilha do usuário
 * (matematicamente confirmada linha a linha, não é suposição):
 *
 *   - PUT  (Cash Secured Put): IR incide sobre o resultado LÍQUIDO
 *          da operação, ou seja, (Prêmio recebido − Custo de recompra).
 *
 *   - CALL (Covered Call): IR incide sobre o PRÊMIO BRUTO de venda,
 *          independentemente do custo de recompra. Se a Call for
 *          exercida, a base do IR passa a ser (Prêmio + resultado da
 *          venda das ações ao strike, isto é (Strike − PM) × Qtd).
 *
 * Isso não é um detalhe arbitrário: são bases de cálculo diferentes
 * por natureza da operação, e replicam exatamente o que o usuário já
 * apura na prática.
 */
const IR_RATE = 0.15;

export type OptionType = 'PUT' | 'CALL';

export interface NetProfitInput {
  optionType: OptionType;
  premiumReceived: number;      // prêmio total recebido na venda (bruto)
  buybackCost?: number;         // custo total de recompra (0 se expirou/exercida sem recompra)
  exercised?: boolean;          // true se a opção foi exercida
  strikeVsAveragePriceResult?: number; // (Strike-PM)×Qtd, só relevante para CALL exercida
  otherCosts?: number;          // corretagem, emolumentos, etc.
}

export interface NetProfitResult {
  grossResult: number;   // resultado bruto da operação (antes do IR)
  irBase: number;         // base efetivamente usada para calcular o IR
  ir: number;
  netProfit: number;
  efficiencyPct: number;  // 1 - (recompra/prêmio), sempre relativo ao prêmio bruto
}

export function calculateNetProfit({
  optionType,
  premiumReceived,
  buybackCost = 0,
  exercised = false,
  strikeVsAveragePriceResult = 0,
  otherCosts = 0,
}: NetProfitInput): NetProfitResult {
  const efficiencyPct =
    premiumReceived > 0 ? Math.round((1 - buybackCost / premiumReceived) * 10000) / 100 : 0;

  if (optionType === 'CALL' && exercised) {
    // Quando exercida, o resultado junta o prêmio da série com o
    // resultado da venda das ações ao strike (pode ser negativo se
    // Strike < PM). O IR incide sobre essa soma.
    const irBase = premiumReceived + strikeVsAveragePriceResult;
    const ir = irBase > 0 ? irBase * IR_RATE : 0;
    return {
      grossResult: irBase,
      irBase,
      ir,
      netProfit: irBase - ir - otherCosts,
      efficiencyPct,
    };
  }

  const grossResult = premiumReceived - buybackCost - otherCosts;

  if (optionType === 'CALL') {
    // CALL não exercida: IR sempre sobre o prêmio bruto, não sobre o líquido.
    const irBase = premiumReceived;
    const ir = irBase > 0 ? irBase * IR_RATE : 0;
    return { grossResult, irBase, ir, netProfit: grossResult - ir, efficiencyPct };
  }

  // PUT: IR sobre o resultado líquido (prêmio - recompra).
  const irBase = grossResult;
  const ir = irBase > 0 ? irBase * IR_RATE : 0;
  return { grossResult, irBase, ir, netProfit: grossResult - ir, efficiencyPct };
}

export interface ProfitabilityInput {
  netProfit: number;
  committedCapital: number;
  daysHeld: number;
}

export function calculateProfitability({
  netProfit,
  committedCapital,
  daysHeld,
}: ProfitabilityInput): { totalPct: number; annualizedPct: number } {
  if (committedCapital <= 0) return { totalPct: 0, annualizedPct: 0 };
  const totalPct = (netProfit / committedCapital) * 100;
  const days = Math.max(1, daysHeld);
  const annualizedPct = totalPct * (365 / days);
  return {
    totalPct: Math.round(totalPct * 100) / 100,
    annualizedPct: Math.round(annualizedPct * 100) / 100,
  };
}

/** Utilitário: dias entre duas datas (inteiro, >= 0). */
export function daysBetween(start: string | Date, end: string | Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
}

// ============================================================
// Fórmulas de Taxa, Distância e Spread — validadas com a
// planilha real do usuário. A Taxa usa referências DIFERENTES
// dependendo do tipo de opção:
//   - PUT:  Taxa = Prêmio ÷ Strike     (o que importa é a garantia)
//   - CALL: Taxa = Prêmio ÷ Cotação    (o que importa é o preço de mercado)
// Distância e Spread são iguais nos dois casos.
// ============================================================

export function calculateStrikeDistance(quote: number, strike: number): number {
  if (quote === 0) return 0;
  return (quote - strike) / quote;
}

export function calculateSpread(quote: number, strike: number): number {
  return quote - strike;
}

export function calculatePremiumRate(optionType: OptionType, premium: number, quote: number, strike: number): number {
  const base = optionType === 'PUT' ? strike : quote;
  if (base === 0) return 0;
  return premium / base;
}

/** Garantia exigida para uma PUT Cash Secured: Strike × Qtd. */
export function calculateGuarantee(strike: number, quantity: number): number {
  return strike * quantity;
}

/**
 * Resultado da venda das ações quando uma CALL é exercida:
 * (Strike - PM) × Qtd. Pode ser negativo se Strike < PM.
 */
export function calculateStockSaleResult(strike: number, averagePrice: number, quantity: number): number {
  return (strike - averagePrice) * quantity;
}

// ============================================================
// Comissão de gestão (para operações feitas em nome de terceiros,
// ex: Mãe). O valor sacado é sempre um lançamento manual à parte
// (withdrawals) — nunca uma fórmula fixa, pois na prática varia
// (100%, 50%, ou nada) a critério do usuário.
// ============================================================

export interface CommissionInput {
  netProfit: number;
  commissionPct: number; // 0-100
}

export function calculateCommission({ netProfit, commissionPct }: CommissionInput): {
  commissionAmount: number;
  holderNetAfterCommission: number;
} {
  if (netProfit <= 0) return { commissionAmount: 0, holderNetAfterCommission: netProfit };
  const commissionAmount = Math.round(netProfit * (commissionPct / 100) * 100) / 100;
  return {
    commissionAmount,
    holderNetAfterCommission: Math.round((netProfit - commissionAmount) * 100) / 100,
  };
}
