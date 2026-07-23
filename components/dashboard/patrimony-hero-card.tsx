'use client';

import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { formatBRL, formatPct, cn } from '@/lib/utils';

interface PatrimonyHeroCardProps {
  currentEquity: number | null;
  totalProfit: number;
  successRatePct: number;
  equitySeries: { date: string; value: number }[];
  onProfitClick?: () => void;
}

/**
 * Faixa de destaque do Patrimônio Atual, no topo do Dashboard —
 * gráfico de área com gradiente por trás do valor, no estilo
 * aprovado pelo usuário. Mantém os mesmos dados já calculados
 * (currentEquity, totalProfit, successRatePct, equitySeries) — só
 * muda a apresentação visual.
 */
export function PatrimonyHeroCard({ currentEquity, totalProfit, successRatePct, equitySeries, onProfitClick }: PatrimonyHeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-br from-accent-muted via-accent-muted/40 to-surface px-6 py-5">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-accent">Patrimônio atual</div>
          <div className="mt-1 font-tabular text-[28px] font-semibold leading-none text-foreground sm:text-[32px]">
            {formatBRL(currentEquity)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <button
              onClick={onProfitClick}
              disabled={!onProfitClick}
              className={cn(totalProfit >= 0 ? 'text-accent' : 'text-danger', onProfitClick && 'hover:underline')}
            >
              {totalProfit >= 0 ? '+' : ''}
              {formatBRL(totalProfit)} no período
            </button>
            <span className="text-accent/80">{formatPct(successRatePct, 1)} taxa de sucesso</span>
          </div>
        </div>
      </div>

      {equitySeries.length >= 2 && (
        <div className="relative z-10 mt-4 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equitySeries} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hero-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#hero-gradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
