// ============================================================
// OptionOS — Geração de prompts para análise via IA externa
//
// Sem custo de API embutido: o sistema monta um resumo formatado
// dos dados (texto pronto) que o usuário copia e cola em qualquer
// chat de IA (Claude, etc). Zero chave, zero custo recorrente.
// ============================================================

import type { Operation } from '@/lib/types/database';
import { formatBRL, formatNumber, formatDate } from '@/lib/utils';

export function buildPortfolioAnalysisPrompt(operations: Operation[]): string {
  const open = operations.filter((o) => o.status === 'aberta');
  const closed = operations.filter((o) => o.status !== 'aberta');

  const totalCommitted = open.reduce((sum, o) => sum + (o.committed_capital || 0), 0);
  const totalPremiums = operations.reduce((sum, o) => sum + (o.premium_received || 0), 0);
  const totalProfit = operations.reduce((sum, o) => sum + (o.net_profit || 0), 0);

  const byAsset = open.reduce<Record<string, { count: number; capital: number }>>((acc, o) => {
    const ticker = o.asset?.ticker ?? '—';
    if (!acc[ticker]) acc[ticker] = { count: 0, capital: 0 };
    acc[ticker].count += 1;
    acc[ticker].capital += o.committed_capital || 0;
    return acc;
  }, {});

  const concentrationLines = Object.entries(byAsset)
    .map(([ticker, d]) => `- ${ticker}: ${d.count} operação(ões), ${formatBRL(d.capital)} comprometido (${totalCommitted > 0 ? ((d.capital / totalCommitted) * 100).toFixed(1) : '0'}% do capital comprometido total)`)
    .join('\n');

  const openLines = open
    .map(
      (o) =>
        `- ${o.asset?.ticker} ${o.option_type} strike ${formatNumber(o.strike)}, vence ${formatDate(o.expiration)}, delta abertura ${formatNumber(o.delta_at_open, 3)}, prêmio ${formatBRL(o.premium_received)}`
    )
    .join('\n');

  return `Analise minha carteira de venda de opções (PUT Cash Secured / Covered Call em blue chips brasileiras) e me dê: operações com maior risco, operações mais promissoras, excesso de concentração, sugestões de atenção e comentários gerais sobre o conjunto.

RESUMO
Capital comprometido: ${formatBRL(totalCommitted)}
Prêmios recebidos (total histórico): ${formatBRL(totalPremiums)}
Lucro líquido total: ${formatBRL(totalProfit)}
Operações abertas: ${open.length}
Operações encerradas: ${closed.length}
Taxa de sucesso (encerradas com lucro): ${closed.length > 0 ? ((closed.filter((o) => (o.net_profit || 0) > 0).length / closed.length) * 100).toFixed(1) : '0'}%

CONCENTRAÇÃO POR ATIVO
${concentrationLines || 'Nenhuma operação aberta.'}

OPERAÇÕES ABERTAS
${openLines || 'Nenhuma.'}`;
}
