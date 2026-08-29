import { NextRequest, NextResponse } from 'next/server';
import { getClientFor, type SystemProfile } from '@/lib/supabase/client';
import { fetchQuote } from '@/lib/quotes/brapi';

export const maxDuration = 60;

interface TickerResult {
  ticker: string;
  price?: number;
  saved?: boolean;
  error?: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const closeDate = new Date().toISOString().slice(0, 10);
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
        const quote = await fetchQuote(row.ticker);
        const { error: upsertError } = await client
          .from('friday_closes')
          .upsert({ ticker: row.ticker, close_date: closeDate, price: quote.price }, { onConflict: 'ticker,close_date' });

        summary[system].push({ ticker: row.ticker, price: quote.price, saved: !upsertError });
      } catch (err) {
        summary[system].push({ ticker: row.ticker, error: err instanceof Error ? err.message : 'Erro desconhecido.' });
      }
    }
  }

  return NextResponse.json({ closeDate, summary });
}
