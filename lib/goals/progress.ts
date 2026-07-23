import type { Goal, Operation } from '@/lib/types/database';

export interface GoalProgress {
  goal: Goal;
  currentValue: number;
  progressPct: number; // 0 a 100+ (pode passar de 100 se a meta foi superada)
  daysRemaining: number | null;
  monthsRemaining: number | null;
  amountRemaining: number; // Valor Alvo - Valor Atual (pode ser negativo se já superou)
  neededPerMonth: number | null; // amountRemaining ÷ monthsRemaining — só com deadline definido
  recentAvgProfitPerMonth: number | null; // contexto: ritmo histórico recente, não usado no cálculo da meta
}

/**
 * Calcula o progresso de um objetivo, lendo os dados que já existem
 * no sistema (Patrimônio Atual, lucro do mês corrente) — sem exigir
 * que o usuário atualize nada manualmente, exceto para metas do tipo
 * 'personalizado', onde current_value é digitado por ele mesmo.
 *
 * "Preciso por mês" é (falta ÷ meses restantes) — uma conta objetiva,
 * sem depender do prêmio médio histórico (que é passado, não previsão
 * de futuro). O prêmio médio recente aparece só como CONTEXTO, para o
 * usuário comparar se seu ritmo atual está perto do que precisa.
 */
export function computeGoalProgress(
  goal: Goal,
  currentEquity: number | null,
  operations: Operation[]
): GoalProgress {
  let currentValue = 0;

  if (goal.target_type === 'patrimonio') {
    currentValue = currentEquity ?? 0;
  } else if (goal.target_type === 'renda_mensal') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentValue = operations
      .filter((o) => o.status !== 'aberta' && o.net_profit !== null && o.closed_at && new Date(o.closed_at) >= monthStart)
      .reduce((sum, o) => sum + (o.net_profit ?? 0), 0);
  } else {
    currentValue = goal.current_value ?? 0;
  }

  const progressPct = goal.target_value > 0 ? Math.round((currentValue / goal.target_value) * 1000) / 10 : 0;
  const amountRemaining = goal.target_value - currentValue;

  const daysRemaining = goal.deadline
    ? Math.ceil((new Date(goal.deadline + 'T00:00:00').getTime() - Date.now()) / 86400000)
    : null;

  const monthsRemaining = daysRemaining !== null ? Math.max(daysRemaining / 30.44, 1 / 30.44) : null;
  const neededPerMonth = monthsRemaining !== null ? amountRemaining / monthsRemaining : null;

  // Contexto: lucro líquido médio dos últimos 3 meses fechados, só para comparação visual.
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const recentClosed = operations.filter(
    (o) => o.status !== 'aberta' && o.net_profit !== null && o.closed_at && new Date(o.closed_at) >= threeMonthsAgo
  );
  const recentAvgProfitPerMonth = recentClosed.length > 0 ? recentClosed.reduce((s, o) => s + (o.net_profit ?? 0), 0) / 3 : null;

  return { goal, currentValue, progressPct, daysRemaining, monthsRemaining, amountRemaining, neededPerMonth, recentAvgProfitPerMonth };
}

export const GOAL_TYPE_LABELS: Record<Goal['target_type'], string> = {
  patrimonio: 'Patrimônio total',
  renda_mensal: 'Renda mensal (mês corrente)',
  personalizado: 'Personalizado',
};
