import type { RelativeRegion } from './image-prep';

/**
 * OptionOS — Regiões calibradas para prints de GRÁFICO do Investing.com
 * (página do ativo, aba "Gráfico", full page screenshot).
 *
 * Calibrado a partir de teste real com print de BPAC11 (1763x4065px).
 * Resultados do teste real:
 *   - header_price: 100% de acerto (ticker, preço, variação)
 *   - header_ranges: 100% de acerto (faixa diária, faixa 52 semanas)
 *   - ohlc_legend: 100% de acerto (Abr/Max/Min/Fch)
 *   - bollinger_legend: ~95% com upscale 5x (sem upscale, ilegível)
 *
 * Se o usuário tirar o print em outra resolução/zoom, as % relativas
 * devem se manter proporcionalmente válidas — mas a calibração foi
 * feita para full-page screenshot no layout desktop do Investing.com.
 * RSI e MACD só aparecem como texto se o usuário adicionar esses
 * indicadores ao gráfico antes do print (caso contrário, ficam
 * em branco e exigem preenchimento manual).
 */
export const INVESTING_CHART_REGIONS: RelativeRegion[] = [
  {
    id: 'header_price',
    label: 'Ticker, preço e variação',
    xPct: [0.0, 0.42],
    yPct: [0.122, 0.145],
    upscale: 2,
  },
  {
    id: 'header_ranges',
    label: 'Faixa diária e faixa 52 semanas',
    xPct: [0.47, 0.65],
    yPct: [0.105, 0.125],
    upscale: 2,
  },
  {
    id: 'ohlc_legend',
    label: 'Legenda OHLC (Abertura/Máxima/Mínima/Fechamento)',
    xPct: [0.02, 0.45],
    yPct: [0.216, 0.222],
    upscale: 3,
  },
  {
    id: 'bollinger_legend',
    label: 'Legenda Bollinger Bands (se presente no gráfico)',
    xPct: [0.02, 0.30],
    yPct: [0.231, 0.237],
    upscale: 5,
  },
  {
    id: 'rsi_legend',
    label: 'RSI (se indicador estiver adicionado ao gráfico)',
    xPct: [0.02, 0.35],
    yPct: [0.30, 0.34], // posição aproximada — RSI normalmente fica em painel abaixo do candle
    upscale: 5,
  },
  {
    id: 'macd_legend',
    label: 'MACD (se indicador estiver adicionado ao gráfico)',
    xPct: [0.02, 0.35],
    yPct: [0.34, 0.38], // posição aproximada — ajustar após validação com print real
    upscale: 5,
  },
];

/**
 * Parseia o texto OCR bruto de cada região em campos estruturados.
 * Cada parser é tolerante a ruído comum do Tesseract (ex: "Prego" no
 * lugar de "Preço" por falta de acentuação — não afeta números).
 */
export interface ParsedChartData {
  ticker: string | null;
  lastPrice: number | null;
  changeAbs: number | null;
  changePct: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  week52Low: number | null;
  week52High: number | null;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  closePrice: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
}

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseHeaderPrice(text: string): Pick<ParsedChartData, 'ticker' | 'lastPrice' | 'changeAbs' | 'changePct'> {
  const tickerMatch = text.match(/([A-Z]{4}\d{1,2})/);
  const priceMatch = text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  const changeMatch = text.match(/([+-]\s?\d+[.,]\d{2})\s*\(([+-]\s?\d+[.,]\d{2})%\)/);

  return {
    ticker: tickerMatch ? tickerMatch[1] : null,
    lastPrice: toNumber(priceMatch?.[1]),
    changeAbs: changeMatch ? toNumber(changeMatch[1]) : null,
    changePct: changeMatch ? toNumber(changeMatch[2]) : null,
  };
}

export function parseHeaderRanges(text: string): Pick<ParsedChartData, 'dayLow' | 'dayHigh' | 'week52Low' | 'week52High'> {
  // Formato esperado: "56,18 ... 59,10" (duas ocorrências: diária e 52 semanas)
  const numbers = [...text.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => toNumber(m[1]));
  return {
    dayLow: numbers[0] ?? null,
    dayHigh: numbers[1] ?? null,
    week52Low: numbers[2] ?? null,
    week52High: numbers[3] ?? null,
  };
}

export function parseOhlcLegend(text: string): Pick<ParsedChartData, 'openPrice' | 'highPrice' | 'lowPrice' | 'closePrice'> {
  const abr = text.match(/Abr\s*(\d+[.,]\d+)/i);
  const max = text.match(/Max\s*(\d+[.,]\d+)/i);
  const min = text.match(/Min\s*(\d+[.,]\d+)/i);
  const fch = text.match(/Fch\s*(\d+[.,]\d+)/i);

  return {
    openPrice: toNumber(abr?.[1]),
    highPrice: toNumber(max?.[1]),
    lowPrice: toNumber(min?.[1]),
    closePrice: toNumber(fch?.[1]),
  };
}

export function parseBollingerLegend(text: string): Pick<ParsedChartData, 'bbUpper' | 'bbMiddle' | 'bbLower'> {
  // Formato: "BB (20, 2) 53.6180 57.8272 49.4088" — três números decimais com ponto
  const numbers = [...text.matchAll(/(\d+\.\d{2,4})/g)].map((m) => parseFloat(m[1]));
  return {
    bbMiddle: numbers[0] ?? null,
    bbUpper: numbers[1] ?? null,
    bbLower: numbers[2] ?? null,
  };
}

export function parseRsiLegend(text: string): Pick<ParsedChartData, 'rsi14'> {
  const match = text.match(/RSI[^0-9]*(\d+[.,]\d+)/i);
  return { rsi14: toNumber(match?.[1]) };
}

export function parseMacdLegend(
  text: string
): Pick<ParsedChartData, 'macdLine' | 'macdSignal' | 'macdHistogram'> {
  const numbers = [...text.matchAll(/(-?\d+[.,]\d+)/g)].map((m) => toNumber(m[1]));
  return {
    macdLine: numbers[0] ?? null,
    macdSignal: numbers[1] ?? null,
    macdHistogram: numbers[2] ?? null,
  };
}
