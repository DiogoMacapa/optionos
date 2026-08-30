export interface QuoteResult {
  ticker: string;
  price: number;
  name: string | null;
  changePercent: number | null;
  updatedAt: string | null;
}

export class QuoteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchQuote(tickerRaw: string): Promise<QuoteResult> {
  const ticker = tickerRaw.trim().toUpperCase();
  if (!ticker) throw new QuoteError('Informe um ticker.', 400);

  const token = process.env.BRAPI_TOKEN;
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });

  if (res.status === 402) {
    throw new QuoteError('Limite mensal de cotações gratuitas atingido (15.000/mês).', 402);
  }
  if (res.status === 404) {
    throw new QuoteError(`Ticker "${ticker}" não encontrado.`, 404);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new QuoteError(`Erro ao buscar cotação (HTTP ${res.status}): ${body.slice(0, 200)}`, 502);
  }

  const data = await res.json();
  const result = data?.results?.[0];
  if (!result) throw new QuoteError(`Sem dados para "${ticker}".`, 404);

  const price = result.regularMarketPrice ?? result.lastPrice ?? result.close ?? null;
  if (price === null) throw new QuoteError(`Preço não disponível para "${ticker}".`, 404);

  return {
    ticker,
    price,
    name: result.shortName ?? null,
    changePercent: result.regularMarketChangePercent ?? null,
    updatedAt: result.regularMarketTime ?? null,
  };
}

export interface HistoricalClose {
  date: string; // YYYY-MM-DD
  price: number;
}

/**
 * Busca os últimos `count` fechamentos de sexta-feira de um ticker,
 * usando o histórico diário da brapi.dev (range/interval). Pede 3
 * meses de histórico pra ter folga mesmo com feriados caindo numa
 * sexta — usado pelo botão "Preencher histórico" da faixa de
 * cotações, pra não precisar esperar as sextas passarem uma a uma.
 */
export async function fetchFridayCloses(tickerRaw: string, count = 4): Promise<HistoricalClose[]> {
  const ticker = tickerRaw.trim().toUpperCase();
  if (!ticker) throw new QuoteError('Informe um ticker.', 400);

  const token = process.env.BRAPI_TOKEN;
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=3mo&interval=1d`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });

  if (res.status === 402) {
    throw new QuoteError('Limite mensal de cotações gratuitas atingido (15.000/mês).', 402);
  }
  if (res.status === 404) {
    throw new QuoteError(`Ticker "${ticker}" não encontrado.`, 404);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new QuoteError(`Erro ao buscar histórico (HTTP ${res.status}): ${body.slice(0, 200)}`, 502);
  }

  const data = await res.json();
  const result = data?.results?.[0];
  const candles = result?.historicalDataPrice as { date: number; close: number | null }[] | undefined;
  if (!candles || candles.length === 0) {
    throw new QuoteError(`Sem histórico para "${ticker}".`, 404);
  }

  return candles
    .filter((c): c is { date: number; close: number } => c.close !== null && c.close !== undefined)
    .map((c) => ({ dateObj: new Date(c.date * 1000), price: c.close }))
    .filter((c) => c.dateObj.getUTCDay() === 5) // 5 = sexta-feira
    .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
    .slice(0, count)
    .map((c) => ({ date: c.dateObj.toISOString().slice(0, 10), price: c.price }));
}
