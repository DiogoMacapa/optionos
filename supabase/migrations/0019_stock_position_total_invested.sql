-- ============================================================
-- OptionOS — Migration 0019
-- stock_positions.total_invested: valor BRUTO que efetivamente saiu
-- de caixa na aquisição (Strike × Quantidade, sem descontar prêmio).
-- Diferente de average_price, que continua sendo o custo AJUSTADO
-- (Strike − Prêmio/ação) — usado no cálculo de Covered Call futura.
-- Os dois números coexistem porque respondem perguntas diferentes:
-- "quanto saiu do meu caixa" vs "qual meu custo real de oportunidade".
-- ============================================================

alter table stock_positions
  add column total_invested numeric(14,2);
