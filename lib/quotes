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
