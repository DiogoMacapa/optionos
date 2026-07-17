-- ============================================================
-- OptionOS — Migration 0009
-- Código da série de opção (ex: VALEW76, BPACF565W1) — diferente
-- do ativo-base (VALE3, BPAC11). Digitado manualmente pelo usuário.
-- ============================================================

alter table operations
  add column option_symbol text;
