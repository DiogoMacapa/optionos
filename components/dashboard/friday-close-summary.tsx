'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck2, History } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';
import { listWatchlistTickers, listFridayCloses } from '@/lib/supabase/queries';
import type { WatchlistTicker, FridayClose } from '@/lib/types/database';

const FRIDAY_WINDOW = 4;

export function FridayCloseSummary() {
  const [tickers, setTickers] = useState<WatchlistTicker[] | null>(null);
  const [closes, setCloses] = useState<FridayClose[]>([]);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  function reload() {
    return Promise.all([listWatchlistTickers(), listFridayCloses()])
      .then(([t, c]) => {
        setTickers(t);
        setCloses(c);
      })
      .catch(() => {
        setTickers([]);
        setCloses([]);
      });
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch('/api/backfill-friday-closes', { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao preencher histórico.');
      await reload();
      setBackfillMsg('Histórico preenchido.');
    } catch {
      setBackfillMsg('Não deu pra preencher agora — tenta de novo em instantes.');
    } finally {
      setBackfilling(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {backfillMsg && <span className="text-[11px] text-faint-foreground">{backfillMsg}</span>}
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="flex items-center gap-1 rounded-full border border-glass-border bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <History className="h-3 w-3" />
            {backfilling ? 'Preenchendo…' : 'Preencher histórico'}
          </button>
        </div>
      </div>
      <div className="mb-3">
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
