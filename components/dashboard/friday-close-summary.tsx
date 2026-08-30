'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';
import { listWatchlistTickers, listFridayCloses } from '@/lib/supabase/queries';
import type { WatchlistTicker, FridayClose } from '@/lib/types/database';

// Janela móvel: a média sempre considera só as sextas mais recentes,
// não o histórico inteiro — reflete melhor o comportamento atual do
// ativo pra decidir strike. Mude esse número se quiser outra janela.
const FRIDAY_WINDOW = 4;

/**
 * Média de fechamento de sexta-feira dos ativos cadastrados na faixa
 * do topo (watchlist_tickers). Os dados vêm de friday_closes, que é
 * populada automaticamente pelo cron job semanal — nada aqui é
 * calculado ou digitado manualmente pelo usuário.
 */
export function FridayCloseSummary() {
  const [tickers, setTickers] = useState<WatchlistTicker[] | null>(null);
  const [closes, setCloses] = useState<FridayClose[]>([]);

  useEffect(() => {
    Promise.all([listWatchlistTickers(), listFridayCloses()])
      .then(([t, c]) => {
        setTickers(t);
        setCloses(c);
      })
      .catch(() => {
        setTickers([]);
        setCloses([]);
      });
  }, []);

  if (tickers === null || tickers.length === 0) return null;

  const byTicker = new Map<string, FridayClose[]>();
  for (const c of closes) {
    if (!byTicker.has(c.ticker)) byTicker.set(c.ticker, []);
    byTicker.get(c.ticker)!.push(c);
  }

  return (
    <div className="rounded-xl border border-glass-border bg-glass p-4 backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck2 className="h-3.5 w-3.5 text-primary-accent" />
          <h3 className="text-sm font-semibold text-foreground">Média das últimas 4 sextas (fechamento)</h3>
        </div>
        <span className="text-[11px] text-faint-foreground">Captura automática toda sexta, depois do pregão fechar</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {tickers.map((t) => {
          const entries = byTicker.get(t.ticker) ?? [];

          if (entries.length === 0) {
            return (
              <div
                key={t.ticker}
                className="flex items-center justify-between rounded-lg border border-glass-border bg-white/[0.02] px-3 py-2 text-xs"
              >
                <span className="font-semibold text-foreground">{t.ticker}</span>
                <span className="text-faint-foreground">Aguardando a primeira sexta-feira</span>
              </div>
            );
          }

          const sorted = [...entries].sort((a, b) => b.close_date.localeCompare(a.close_date));
          const windowed = sorted.slice(0, FRIDAY_WINDOW);
          const avg = windowed.reduce((sum, e) => sum + Number(e.price), 0) / windowed.length;

          return (
            <div
              key={t.ticker}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-glass-border bg-white/[0.02] px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{t.ticker}</span>
                <span className="text-faint-foreground">
                  últimas {windowed.length} sexta{windowed.length > 1 ? 's' : ''}
                  {entries.length > FRIDAY_WINDOW ? ` de ${entries.length} registradas` : ''}
                </span>
              </div>
              <div className="flex items-center gap-4 font-tabular">
                <span className="text-faint-foreground">
                  Última ({formatDate(sorted[0].close_date)}): {formatNumber(Number(sorted[0].price))}
                </span>
                <span className="font-semibold text-primary-accent">Média: {formatNumber(avg)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
