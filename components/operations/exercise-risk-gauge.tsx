'use client';

import { cn, formatNumber } from '@/lib/utils';

interface ExerciseRiskGaugeProps {
  strike: number;
  quote: number | null;
  optionType: 'PUT' | 'CALL';
}

/**
 * Indicador visual compacto por operação: posição da cotação em
 * relação ao strike, com rótulos numéricos nas duas referências (não
 * só uma barra "solta" sem contexto) e um badge de status claro
 * (Dentro/Fora do dinheiro) em vez de probabilidade — mais direto de
 * ler numa olhada rápida na tabela.
 */
export function ExerciseRiskGauge({ strike, quote, optionType }: ExerciseRiskGaugeProps) {
  if (quote === null || quote === undefined || quote === 0) {
    return <span className="text-[10px] text-faint-foreground">sem cotação</span>;
  }

  // Janela de +-15% do strike para posicionar a cotação na barra.
  const windowPct = 0.15;
  const lowerBound = strike * (1 - windowPct);
  const upperBound = strike * (1 + windowPct);
  const clampedQuote = Math.min(Math.max(quote, lowerBound), upperBound);
  const quotePositionPct = ((clampedQuote - lowerBound) / (upperBound - lowerBound)) * 100;

  // PUT exerce se cotação < strike; CALL exerce se cotação > strike.
  const isITM = optionType === 'PUT' ? quote < strike : quote > strike;

  return (
    <div className="flex w-[136px] flex-col gap-1">
      <div className={cn('w-fit rounded px-1.5 py-0.5 text-[9.5px] font-bold', isITM ? 'bg-danger-muted text-danger' : 'bg-accent-muted text-accent')}>
        {isITM ? 'Dentro do dinheiro' : 'Fora do dinheiro'}
      </div>

      <div className="relative h-2 w-full rounded-full bg-surface-elevated">
        {/* marcador do strike, sempre no centro da janela */}
        <div className="absolute top-1/2 left-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground/50" />
        {/* marcador da cotação atual */}
        <div
          className={cn('absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface', isITM ? 'bg-danger' : 'bg-accent')}
          style={{ left: `${quotePositionPct}%` }}
        />
      </div>

      <div className="flex justify-between text-[9.5px] font-tabular text-faint-foreground">
        <span>Cot. {formatNumber(quote, 2)}</span>
        <span>Strike {formatNumber(strike, 2)}</span>
      </div>
    </div>
  );
}
