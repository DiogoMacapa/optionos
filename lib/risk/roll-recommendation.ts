export type RiskLevel = 'safe' | 'watch' | 'roll';

export interface RollRecommendation {
  level: RiskLevel;
  label: string; // "Manter" | "Atenção" | "Considere rolar"
  distancePct: number | null; // distância % da cotação até o strike (positivo = OTM, negativo = ITM)
  isITM: boolean;
}

/**
 * Recomendação de rolar ou não, baseada só em Cotação x Strike —
 * sem nenhum dado externo (contexto de mercado, IV, etc), já que
 * essa análise mais completa o usuário já faz colando o print da
 * operação no chat com o Claude. Aqui é uma régua simples e objetiva:
 *
 *   já ITM (dentro do dinheiro)     -> Considere rolar
 *   OTM mas dentro de 2%            -> Considere rolar (ponto de alerta
 *                                       confirmado com o usuário)
 *   OTM entre 2% e 5%               -> Atenção
 *   OTM acima de 5%                 -> Manter
 */
export function computeRollRecommendation(strike: number, quote: number | null, optionType: 'PUT' | 'CALL'): RollRecommendation {
  if (quote === null || quote === undefined || quote === 0 || strike <= 0) {
    return { level: 'safe', label: 'Sem cotação', distancePct: null, isITM: false };
  }

  const isITM = optionType === 'PUT' ? quote < strike : quote > strike;

  // Distância % sempre positiva quando seguro (OTM), negativa quando ITM.
  const rawDistance = optionType === 'PUT' ? (quote - strike) / quote : (strike - quote) / quote;
  const distancePct = Math.round(rawDistance * 1000) / 10;

  if (isITM || distancePct <= 2) {
    return { level: 'roll', label: 'Considere rolar', distancePct, isITM };
  }
  if (distancePct <= 5) {
    return { level: 'watch', label: 'Atenção', distancePct, isITM };
  }
  return { level: 'safe', label: 'Manter', distancePct, isITM };
}
