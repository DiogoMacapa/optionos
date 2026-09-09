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
  estimatedMonthsToTarget: number | null; // só para target_type = 'premios_comissao' — projeção pelo ritmo médio histórico
}

export function computeGoalProgress(
  goal: Goal,
  currentEquity: number | null,
  operations: Operation[],
  extraCash: number = 0,
  totalPremiosComissaoOverride: number | null = null
): GoalProgress {
  let currentValue = 0;

  if (goal.target_type === 'patrimonio') {
    currentValue = (currentEquity ?? 0) + extraCash;
  } else if (goal.target_type === 'renda_mensal') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentValue = operations
      .filter((o) => o.status !== 'aberta' && o.net_profit !== null && o.closed_at && new Date(o.closed_at) >= monthStart)
      .reduce((sum, o) => sum + (o.net_profit ?? 0), 0);
  } else if (goal.target_type === 'premios_comissao') {
    currentValue = totalPremiosComissaoOverride ?? 0;
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

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const recentClosed = operations.filter(
    (o) => o.status !== 'aberta' && o.net_profit !== null && o.closed_at && new Date(o.closed_at) >= threeMonthsAgo
  );
  const recentAvgProfitPerMonth = recentClosed.length > 0 ? recentClosed.reduce((s, o) => s + (o.net_profit ?? 0), 0) / 3 : null;

  let estimatedMonthsToTarget: number | null = null;
  if (goal.target_type === 'premios_comissao' && operations.length > 0 && currentValue > 0) {
    const earliestDate = operations.reduce<Date | null>((earliest, o) => {
      const d = new Date(o.opened_at);
      return !earliest || d < earliest ? d : earliest;
    }, null);
    if (earliestDate) {
      const monthsSinceStart = Math.max((Date.now() - earliestDate.getTime()) / (30.44 * 86400000), 1 / 30.44);
      const avgPacePerMonth = currentValue / monthsSinceStart;
      if (avgPacePerMonth > 0) {
        estimatedMonthsToTarget = Math.max(0, amountRemaining) / avgPacePerMonth;
      }
    }
  }

  return {
    goal,
    currentValue,
    progressPct,
    daysRemaining,
    monthsRemaining,
    amountRemaining,
    neededPerMonth,
    recentAvgProfitPerMonth,
    estimatedMonthsToTarget,
  };
}

export const GOAL_TYPE_LABELS: Record<Goal['target_type'], string> = {
  patrimonio: 'Patrimônio total',
  renda_mensal: 'Renda mensal (mês corrente)',
  premios_comissao: 'Prêmios + Comissão (quanto tempo vou levar)',
  personalizado: 'Personalizado',
};
