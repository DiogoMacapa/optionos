import { NextResponse } from 'next/server';
import { getClientFor, type SystemProfile } from '@/lib/supabase/client';
import { fetchFridayCloses } from '@/lib/quotes/brapi';

export const maxDuration = 60;

interface TickerResult {
  ticker: string;
  saved?: number;
  error?: string;
}

export async function POST() {
  const summary: Record<SystemProfile, TickerResult[]> = { diogo: [], mae: [] };

  for (const system of ['diogo', 'mae'] as const) {
    const client = getClientFor(system);

    const { data: tickers, error: listError } = await client.from('watchlist_tickers').select('ticker');
    if (listError) {
      summary[system] = [{ ticker: '*', error: listError.message }];
      continue;
    }

    for (const row of tickers ?? []) {
      try {
        const fridays = await fetchFridayCloses(row.ticker, 4);
        for (const f of fridays) {
          await client
            .from('friday_closes')
            .upsert(
              { ticker: row.ticker, close_date: f.date, price: f.price },
              { onConflict: 'ticker,close_date', ignoreDuplicates: true }
            );
        }
        summary[system].push({ ticker: row.ticker, saved: fridays.length });
      } catch (err) {
        summary[system].push({ ticker: row.ticker, error: err instanceof Error ? err.message : 'Erro desconhecido.' });
      }
    }
  }

  return NextResponse.json({ summary });
}
