'use client';

import { cn } from '@/lib/utils';
import type { RollRecommendation } from '@/lib/risk/roll-recommendation';

interface RiskGaugeSpeedometerProps {
  recommendation: RollRecommendation;
}

/**
 * Velocímetro semicircular (vermelho -> amarelo -> verde) com
 * ponteiro indicando o risco de exercício, baseado na referência
 * visual que o usuário aprovou. O ponteiro aponta para a posição da
 * distância % dentro da régua (ITM/perto = vermelho, meio = amarelo,
 * longe = verde) — mostrado lado a lado com a barra linear existente,
 * para o usuário comparar e decidir qual manter.
 */
export function RiskGaugeSpeedometer({ recommendation }: RiskGaugeSpeedometerProps) {
  const { level, label, distancePct } = recommendation;

  if (distancePct === null) {
    return <span className="text-[10px] text-faint-foreground">sem cotação</span>;
  }

  // Mapeia distância % (-10 a +15, clampado) para 0-100 na régua do ponteiro.
  const clamped = Math.min(Math.max(distancePct, -10), 15);
  const gaugePct = ((clamped + 10) / 25) * 100;

  // Ângulo do ponteiro: -90deg (extremo esquerdo/vermelho) a +90deg (extremo direito/verde).
  const angle = -90 + (gaugePct / 100) * 180;

  const color = level === 'roll' ? 'var(--danger)' : level === 'watch' ? 'var(--warning)' : 'var(--accent)';

  return (
    <div className="flex w-[92px] flex-col items-center gap-0.5">
      <svg viewBox="0 0 100 56" className="w-full">
        <path d="M 8 50 A 42 42 0 0 1 36 10" fill="none" stroke="var(--danger)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 36 10 A 42 42 0 0 1 64 10" fill="none" stroke="var(--warning)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 64 10 A 42 42 0 0 1 92 50" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" />
        <g transform={`rotate(${angle} 50 50)`}>
          <line x1="50" y1="50" x2="50" y2="16" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="4" fill="var(--foreground)" />
      </svg>
      <span className={cn('text-[9.5px] font-bold')} style={{ color }}>
        {label}
      </span>
    </div>
  );
}
