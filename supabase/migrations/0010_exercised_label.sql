-- ============================================================
-- OptionOS — Migration 0010
-- 'Exercido?' editável manualmente com 3 estados: Sim, Não, Rolagem.
-- Substitui a leitura implícita do campo boolean 'exercised' para
-- fins de exibição/edição na coluna da tabela — alimenta estatísticas
-- e Dashboard com um dado mais preciso do que só sim/não.
-- ============================================================

alter table operations
  add column exercised_label text check (exercised_label in ('Sim', 'Não', 'Rolagem'));

-- Backfill: operações já marcadas com exercised=true viram 'Sim'
update operations set exercised_label = 'Sim' where exercised = true and exercised_label is null;
