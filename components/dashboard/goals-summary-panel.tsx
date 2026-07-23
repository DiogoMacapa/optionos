'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listGoals } from '@/lib/supabase/queries';
import { computeGoalProgress } from '@/lib/goals/progress';
import type { Goal, Operation } from '@/lib/types/database';

interface GoalsSummaryPanelProps {
  currentEquity: number | null;
  operations: Operation[];
}

/**
 * Resumo compacto dos objetivos ativos, para o Dashboard — mostra
 * até 3 metas com barra de progresso. Link para a tela completa de
 * Objetivos, onde aparece o gráfico de projeção detalhado.
 */
export function GoalsSummaryPanel({ currentEquity, operations }: GoalsSummaryPanelProps) {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    listGoals()
      .then(setGoals)
      .catch(() => setGoals([]));
  }, []);

  if (goals.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" />
          <span className="text-sm text-foreground">Objetivos</span>
        </div>
        <Link href="/objetivos" className="flex items-center gap-1 text-xs text-accent hover:underline">
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {goals.slice(0, 3).map((goal) => {
          const progress = computeGoalProgress(goal, currentEquity, operations);
          const capped = Math.min(progress.progressPct, 100);
          return (
            <div key={goal.id} className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={goal.name}>
                {goal.name}
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                <div className={cn('h-full rounded-full', capped >= 100 ? 'bg-accent' : 'bg-accent/70')} style={{ width: `${Math.max(capped, 2)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right font-tabular text-xs text-foreground">{progress.progressPct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
