'use client';

import { cn } from '@/lib/utils';

interface ExerciseRiskGaugeProps {
  strike: number;
  quote: number | null;
  delta: number | null; // usado direto como probabilidade de exercício (convenção de mercado)
  optionType: 'PUT' | 'CALL';
}

/**
 * Indicador visual compacto por operação: posição da cotação em
 * relação ao strike (barra), e probabilidade de exercício usando o
 * Delta que o usuário já preenche (sem recalcular nada — Delta já É
 * a probabilidade aproximada de exercício na convenção de mercado).
 */
export function ExerciseRiskGauge({ strike, quote, delta, optionType }: ExerciseRiskGaugeProps) {
  if (quote === null || quote === undefined || quote === 0) {
    return <span className="text-[10px] text-faint-foreground">sem cotação</span>;
  }

  // Posição da cotação relativa a uma janela em torno do strike, para desenhar a barra.
  // Janela de +-15% do strike, suficiente para visualizar a distância típica das operações.
  const windowPct = 0.15;
  const lowerBound = strike * (1 - windowPct);
  const upperBound = strike * (1 + windowPct);
  const clampedQuote = Math.min(Math.max(quote, lowerBound), upperBound);
  const positionPct = ((clampedQuote - lowerBound) / (upperBound - lowerBound)) * 100;
  const strikePositionPct = 50; // strike sempre no centro da janela

  // Risco de exercício pela posição atual (sem depender do Delta):
  // PUT exerce se cotação < strike; CALL exerce se cotação > strike.
  const isITM = optionType === 'PUT' ? quote < strike : quote > strike;

  const probabilityPct = delta !== null && delta !== undefined ? Math.abs(delta) * 100 : null;

  return (
    <div className="flex w-[120px] flex-col gap-1">
      <div className="relative h-1.5 w-full rounded-full bg-surface-elevated">
        {/* marcador do strike, sempre no centro */}
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-faint-foreground"
          style={{ left: `${strikePositionPct}%` }}
          title={`Strike: ${strike.toFixed(2)}`}
        />
        {/* marcador da cotação atual */}
        <div
          className={cn('absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface', isITM ? 'bg-danger' : 'bg-accent')}
          style={{ left: `${positionPct}%` }}
          title={`Cotação: ${quote.toFixed(2)}`}
        />
      </div>
      {probabilityPct !== null ? (
        <span className={cn('text-[10px] font-tabular', probabilityPct >= 50 ? 'text-danger' : 'text-faint-foreground')}>
          {probabilityPct.toFixed(0)}% prob. exercício
        </span>
      ) : (
        <span className="text-[10px] text-faint-foreground">preencha Delta p/ probabilidade</span>
      )}
    </div>
  );
}
