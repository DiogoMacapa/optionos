-- ============================================================
-- OptionOS — Migration 0021
-- strategy_settings.extra_cash_for_goals: caixa que o usuário tem
-- disponível MAS que não veio do resultado das operações de PUT/CALL
-- (ex: aporte próprio, saldo prévio). Soma SOMENTE ao progresso da
-- meta de Patrimônio na tela de Objetivos — não entra no cálculo
-- geral de "Patrimônio Atual" do Dashboard, confirmado com o usuário.
-- ============================================================

alter table strategy_settings
  add column extra_cash_for_goals numeric(14,2) not null default 0;
