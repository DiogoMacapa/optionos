// ============================================================
// OptionOS — Parser do BOOK DE OPÇÕES (BTG Pactual)
//
// Diferente do gráfico, o book é tabular por natureza (linhas de
// strike/prêmio/delta/bid/ask), o que historicamente dá melhor
// resultado de OCR do que texto pequeno solto — mas ainda exige
// validação real com um print do BTG antes de confiar 100%.
// Este parser assume que o usuário recorta (ou o sistema recorta
// automaticamente, uma vez calibrado) a tabela inteira do book,
// e interpreta linha por linha.
// ============================================================

export interface ParsedOptionRow {
  strike: number | null;
  premium: number | null; // normalmente = bid, para quem vende
  bid: number | null;
  ask: number | null;
  delta: number | null;
  volume: number | null;
  openInterest: number | null;
  rawLine: string;
  confidence: 'alta' | 'media' | 'baixa';
}

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tenta extrair uma linha de book de opções a partir de texto OCR bruto.
 * Layout esperado do BTG (colunas, ordem pode variar por versão do app):
 * Strike | Delta | Prêmio/Bid | Ask | Volume | OI
 *
 * IMPORTANTE: este parser é heurístico. Diferente do header de preço
 * (validado com 100% de acerto em teste real), o layout exato do book
 * do BTG ainda não foi validado com um print real — por isso todo
 * resultado aqui deve passar pela tela de confirmação antes de salvar,
 * sem exceção, até que validemos com um print de exemplo.
 */
export function parseOptionBookLine(line: string): ParsedOptionRow {
  const numbers = [...line.matchAll(/(-?\d+[.,]\d+)/g)].map((m) => toNumber(m[1]));

  // Delta é o único valor tipicamente entre -1 e 1 (ou 0 e 1 para calls) —
  // usamos isso para identificá-lo em meio aos outros números.
  const deltaCandidateIdx = numbers.findIndex((n) => n !== null && Math.abs(n) <= 1);
  const delta = deltaCandidateIdx >= 0 ? numbers[deltaCandidateIdx] : null;

  const remaining = numbers.filter((_, idx) => idx !== deltaCandidateIdx);

  const confidence: ParsedOptionRow['confidence'] =
    numbers.length >= 4 ? 'media' : numbers.length >= 2 ? 'baixa' : 'baixa';

  return {
    strike: remaining[0] ?? null,
    premium: remaining[1] ?? null,
    bid: remaining[1] ?? null,
    ask: remaining[2] ?? null,
    delta,
    volume: remaining[3] ? Math.round(remaining[3]) : null,
    openInterest: remaining[4] ? Math.round(remaining[4]) : null,
    rawLine: line.trim(),
    confidence,
  };
}

export function parseOptionBookText(text: string): ParsedOptionRow[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && /\d/.test(l))
    .map(parseOptionBookLine)
    .filter((row) => row.strike !== null); // descarta linhas sem strike identificável
}
