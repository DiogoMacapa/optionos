// ============================================================
// OptionOS — Calculadoras financeiras
// ============================================================

const CONTRACT_SIZE = 100; // 1 contrato de opção = 100 ações no Brasil

export interface MaxContractsInput {
  availableCash: number;
  strike: number;
}

export function calculateMaxContracts({ availableCash, strike }: MaxContractsInput): number {
  const capitalPerContract = strike * CONTRACT_SIZE;
  if (capitalPerContract <= 0) return 0;
  return Math.floor(availableCash / capitalPerContract);
}

export interface RequiredCapitalInput {
  strike: number;
  quantity: number;
}

export function calculateRequiredCapital({ strike, quantity }: RequiredCapitalInput): number {
  return strike * CONTRACT_SIZE * quantity;
}

export interface ExpectedPremiumInput {
  premium: number;
  quantity: number;
}

export function calculateExpectedPremium({ premium, quantity }: ExpectedPremiumInput): number {
  return premium * CONTRACT_SIZE * quantity;
}

/**
 * IR sobre operações de opções no Brasil: 15% sobre o ganho líquido
 * (day trade é 20%, mas venda coberta de opção com vencimento normalmente
 * se enquadra como operação comum de renda variável = 15%).
 * Isenção de R$20.000/mês em vendas de ações NÃO se aplica a opções.
 */
const IR_RATE = 0.15;

export interface NetProfitInput {
  premiumReceived: number;
  buybackCost?: number; // custo de recompra, se encerrada antes do vencimento (0 se expirou/exercida)
  otherCosts?: number;  // corretagem, emolumentos, etc.
}

export function calculateGrossProfit({
  premiumReceived,
  buybackCost = 0,
  otherCosts = 0,
}: NetProfitInput): number {
  return premiumReceived - buybackCost - otherCosts;
}

export function calculateIR(grossProfit: number): number {
  if (grossProfit <= 0) return 0;
  return grossProfit * IR_RATE;
}

export function calculateNetProfit(input: NetProfitInput): {
  grossProfit: number;
  ir: number;
  netProfit: number;
} {
  const grossProfit = calculateGrossProfit(input);
  const ir = calculateIR(grossProfit);
  return {
    grossProfit,
    ir,
    netProfit: grossProfit - ir,
  };
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
