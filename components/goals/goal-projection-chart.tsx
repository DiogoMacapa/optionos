'use client';

import { formatBRL } from '@/lib/utils';
import type { GoalProgress } from '@/lib/goals/progress';

interface GoalProjectionChartProps {
  progress: GoalProgress;
}

/**
 * Mostra onde o usuário está (ponto atual), onde a meta está (linha
 * pontilhada horizontal no valor alvo), e a linha de projeção
 * necessária (reta ligando hoje até o alvo na data limite) — a
 * inclinação dessa reta É visualmente "quanto preciso por mês".
 * Só renderiza a projeção quando há prazo definido.
 */
export function GoalProjectionChart({ progress }: GoalProjectionChartProps) {
  const { goal, currentValue } = progress;

  if (!goal.deadline) {
    return (
      <p className="text-xs text-faint-foreground">
        Defina uma data limite para ver a projeção de quanto você precisa juntar por mês.
      </p>
    );
  }

  const width = 400;
  const height = 120;
  const padTop = 10;
  const padBottom = 24;
  const plotHeight = height - padTop - padBottom;

  const maxScale = Math.max(goal.target_value, currentValue) * 1.1;
  const yFor = (v: number) => padTop + plotHeight - (Math.max(v, 0) / maxScale) * plotHeight;

  const startX = 20;
  const endX = width - 20;

  const yNow = yFor(currentValue);
  const yTarget = yFor(goal.target_value);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 120 }}>
        <line x1={startX} y1={yTarget} x2={endX} y2={yTarget} stroke="var(--faint-foreground)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={endX} y={yTarget - 6} textAnchor="end" className="fill-faint-foreground" style={{ fontSize: 10 }}>
          meta: {formatBRL(goal.target_value)}
        </text>

        <line x1={startX} y1={yNow} x2={endX} y2={yTarget} stroke="var(--accent)" strokeWidth="2" />

        <circle cx={startX} cy={yNow} r="4" fill="var(--accent)" />
        <text x={startX} y={yNow - 8} textAnchor="start" className="fill-accent" style={{ fontSize: 10, fontWeight: 500 }}>
          hoje: {formatBRL(currentValue)}
        </text>

        <circle cx={endX} cy={yTarget} r="4" fill="var(--accent)" fillOpacity="0.4" />
      </svg>

      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-faint-foreground">hoje</span>
        <span className="text-faint-foreground">{new Date(goal.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  );
}
