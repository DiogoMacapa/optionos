import { NextRequest, NextResponse } from 'next/server';
import { fetchQuote, QuoteError } from '@/lib/quotes/brapi';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');

  if (!ticker?.trim()) {
    return NextResponse.json({ error: 'Informe um ticker.' }, { status: 400 });
  }

  try {
    const quote = await fetchQuote(ticker);
    return NextResponse.json(quote);
  } catch (err) {
    if (err instanceof QuoteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido ao buscar cotação.' },
      { status: 500 }
    );
  }
}
