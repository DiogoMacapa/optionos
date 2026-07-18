-- ============================================================
-- OptionOS — Migration 0013
-- Permite marcar operações como "histórico" — contam para
-- Aprendizado/estatísticas normalmente, mas NÃO entram de novo na
-- soma de Patrimônio/Caixa (usado quando o Patrimônio Inicial já
-- reflete o resultado dessas operações, evitando contagem duplicada).
-- ============================================================

alter table operations
  add column counts_toward_equity boolean not null default true;

-- Marca como histórico as operações que já existem no banco hoje
-- (o usuário confirmou: o Patrimônio Inicial dele já inclui o
-- resultado dessas 13 operações importadas da planilha).
update operations set counts_toward_equity = false;
