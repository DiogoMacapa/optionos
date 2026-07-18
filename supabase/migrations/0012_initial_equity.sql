-- ============================================================
-- OptionOS — Migration 0012
-- Patrimônio Inicial: informado UMA VEZ (o caixa que o usuário tinha
-- antes da primeira operação registrada no sistema). A partir daí,
-- o Patrimônio Atual é sempre calculado automaticamente:
--
--   Patrimônio Atual = Patrimônio Inicial
--                     + soma do lucro líquido de operações fechadas
--                     − soma dos saques registrados
--                     + Reserva de Emergência
--
-- Elimina a necessidade de atualizar "Caixa disponível" manualmente
-- toda semana — o sistema lê o histórico de operações sozinho.
-- ============================================================

alter table strategy_settings
  add column initial_equity numeric(14,2); -- patrimônio (caixa) antes da primeira operação no sistema
