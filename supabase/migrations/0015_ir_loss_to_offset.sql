-- ============================================================
-- OptionOS — Migration 0015
-- Solução final para o Crédito de IR (após 2 tentativas anteriores
-- não corresponderem ao fluxo real do usuário, que já usa um app
-- externo dedicado para calcular a compensação de IR mês a mês).
--
-- Modelo final: um único campo por titular, atualizado manualmente,
-- representando o saldo de prejuízo AINDA NÃO compensado (visto no
-- app externo). Não soma ao Patrimônio — é um indicador informativo
-- separado, mostrando "quanto de IR futuro você ainda vai deixar de
-- pagar", sem contaminar o número de caixa real disponível hoje.
--
-- Remove por completo a tentativa anterior (coluna por operação +
-- view calculada), que tentava replicar um cálculo fiscal que já é
-- feito corretamente em outro lugar — risco de duas fontes de
-- verdade divergindo.
-- ============================================================

-- Remove o modelo anterior (migration 0014), que ficou obsoleto.
alter table operations drop column if exists ir_credit_generated;
drop view if exists ir_credit_summary;

-- Campo único, manual, por titular.
alter table strategy_settings
  add column ir_loss_to_offset numeric(14,2) not null default 0;
