'use client';

import { formatBRL } from '@/lib/utils';
import type { GoalProgress } from '@/lib/goals/progress';

interface EquityPoint {
  date: string;
  value: number;
}

interface GoalProjectionChartProps {
  progress: GoalProgress;
  equitySeries: EquityPoint[]; // só usado para metas do tipo 'patrimonio' — histórico real
}

/**
 * Mostra a trajetória real até hoje (linha sólida, a partir do
 * histórico de operações/comissões/saques) e a projeção necessária
 * até a meta (linha pontilhada, do ponto atual até o alvo na data
 * limite) — a inclinação da parte pontilhada É visualmente "quanto
 * preciso por mês". Só a meta tipo 'patrimonio' tem histórico real
 * disponível; as demais mostram só a reta de projeção.
 */
export function GoalProjectionChart({ progress, equitySeries }: GoalProjectionChartProps) {
  const { goal, currentValue } = progress;

  if (!goal.deadline) {
    return (
      <p className="text-xs text-faint-foreground">
        Defina uma data limite para ver a projeção de quanto você precisa juntar por mês.
      </p>
    );
  }

  const width = 400;
  const height = 130;
  const padTop = 14;
  const padBottom = 24;
  const plotHeight = height - padTop - padBottom;

  const history = goal.target_type === 'patrimonio' ? equitySeries : [];
  const todayDate = new Date();
  const deadlineDate = new Date(goal.deadline + 'T00:00:00');
  const historyStartDate = history.length > 0 ? new Date(history[0].date) : todayDate;

  const totalSpanMs = Math.max(deadlineDate.getTime() - historyStartDate.getTime(), 1);
  const xFor = (d: Date) => 20 + ((d.getTime() - historyStartDate.getTime()) / totalSpanMs) * (width - 40);

  const maxScale = Math.max(goal.target_value, currentValue, ...history.map((h) => h.value)) * 1.08;
  const yFor = (v: number) => padTop + plotHeight - (Math.max(v, 0) / maxScale) * plotHeight;

  const xToday = xFor(todayDate);
  const xEnd = xFor(deadlineDate);
  const yNow = yFor(currentValue);
  const yTarget = yFor(goal.target_value);

  const historyPath = history.map((p) => `${xFor(new Date(p.date))},${yFor(p.value)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 130 }}>
        <line x1="20" y1={yTarget} x2={width - 20} y2={yTarget} stroke="var(--faint-foreground)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={width - 20} y={yTarget - 6} textAnchor="end" className="fill-faint-foreground" style={{ fontSize: 10 }}>
          meta: {formatBRL(goal.target_value)}
        </text>

        {history.length > 1 && <polyline points={historyPath} fill="none" stroke="var(--accent)" strokeWidth="2" />}

        <line x1={xToday} y1={yNow} x2={xEnd} y2={yTarget} stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" strokeOpacity="0.7" />

        <circle cx={xToday} cy={yNow} r="4" fill="var(--accent)" />
        <text x={xToday} y={yNow - 8} textAnchor="middle" className="fill-accent" style={{ fontSize: 10, fontWeight: 500 }}>
          hoje: {formatBRL(currentValue)}
        </text>

        <circle cx={xEnd} cy={yTarget} r="4" fill="var(--accent)" fillOpacity="0.4" />
      </svg>

      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-faint-foreground">{history.length > 1 ? new Date(history[0].date).toLocaleDateString('pt-BR') : 'hoje'}</span>
        <span className="text-faint-foreground">{deadlineDate.toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  );
}
