import { NextRequest, NextResponse } from 'next/server';

/**
 * Busca a cotação atual de um ticker via brapi.dev.
 *
 * O token fica só no servidor (variável de ambiente BRAPI_TOKEN),
 * nunca é exposto ao navegador. Plano gratuito: 15.000 requisições/mês,
 * 1 ticker por chamada — suficiente para uso pessoal.
 *
 * Uso: GET /api/quote?ticker=PETR4
 */
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')?.trim().toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'Informe um ticker.' }, { status: 400 });
  }

  const token = process.env.BRAPI_TOKEN;

  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // Evita cache do Next.js — cotação deve ser sempre atual na hora do clique.
      cache: 'no-store',
    });

    if (res.status === 402) {
      return NextResponse.json(
        { error: 'Limite mensal de cotações gratuitas atingido (15.000/mês). Tente novamente no próximo mês, ou digite manualmente.' },
        { status: 402 }
      );
    }

    if (res.status === 404) {
      return NextResponse.json({ error: `Ticker "${ticker}" não encontrado.` }, { status: 404 });
    }

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Erro ao buscar cotação (HTTP ${res.status}): ${body.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data?.results?.[0];

    if (!result) {
      return NextResponse.json({ error: `Sem dados para "${ticker}".` }, { status: 404 });
    }

    const price = result.regularMarketPrice ?? result.lastPrice ?? result.close ?? null;

    if (price === null) {
      return NextResponse.json({ error: `Preço não disponível para "${ticker}".` }, { status: 404 });
    }

    return NextResponse.json({
      ticker,
      price,
      name: result.shortName ?? null,
      changePercent: result.regularMarketChangePercent ?? null,
      updatedAt: result.regularMarketTime ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido ao buscar cotação.' },
      { status: 500 }
    );
  }
}
