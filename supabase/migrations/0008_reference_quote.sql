-- ============================================================
-- OptionOS — Migration 0008
-- Cotação de referência por operação (com automação via brapi.dev,
-- igual à Calculadora) e ajustes de edição inline.
-- ============================================================

alter table operations
  add column reference_quote numeric(12,4);  -- cotação no momento do registro/consulta, editável e auto-preenchível
