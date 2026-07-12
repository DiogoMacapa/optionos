// ============================================================
// OptionOS — Glossário educativo
// Explicações simples e objetivas exibidas ao clicar em indicadores.
// ============================================================

export interface GlossaryEntry {
  term: string;
  explanation: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  delta: {
    term: 'Delta',
    explanation:
      'Mede o quanto o preço da opção varia para cada R$1 de variação no preço do ativo. Também funciona como uma estimativa aproximada da probabilidade de a opção ser exercida. Delta 0,20 costuma indicar algo perto de 20% de chance de exercício — quanto menor, mais seguro contra exercício, mas menor o prêmio.',
  },
  spread: {
    term: 'Spread',
    explanation:
      'Diferença entre o preço de compra (bid) e o de venda (ask) de uma opção. Spreads apertados indicam mercado mais líquido e eficiente; spreads largos tornam mais caro entrar ou sair da operação.',
  },
  liquidez: {
    term: 'Liquidez',
    explanation:
      'Indica a facilidade de comprar ou vender uma opção sem afetar muito o preço. É medida pelo volume negociado no dia e pelo open interest (contratos em aberto). Mais liquidez = mais segurança para operar.',
  },
  premio: {
    term: 'Prêmio',
    explanation:
      'Valor recebido por quem vende (lança) uma opção. É o seu ganho na operação caso ela não seja exercida. Multiplicado por 100 (tamanho do contrato) e pela quantidade de contratos vendidos.',
  },
  strike: {
    term: 'Strike',
    explanation:
      'Preço de exercício da opção — o valor pelo qual o ativo será comprado (PUT) ou vendido (CALL) caso a opção seja exercida. Quanto mais distante do preço atual, menor a chance de exercício.',
  },
  exercicio: {
    term: 'Exercício',
    explanation:
      'Acontece quando o comprador da opção decide usar seu direito. Em uma PUT vendida, você é obrigado a comprar o ativo pelo strike; em uma CALL coberta, você é obrigado a vender pelo strike. Normalmente ocorre quando a opção termina "dentro do dinheiro" (ITM) no vencimento.',
  },
  rolagem: {
    term: 'Rolagem',
    explanation:
      'Estratégia de encerrar uma operação antes do vencimento e abrir uma nova, geralmente com strike e/ou vencimento diferentes, para evitar o exercício ou melhorar a posição. O custo de recompra da operação antiga é descontado do novo prêmio recebido.',
  },
};
