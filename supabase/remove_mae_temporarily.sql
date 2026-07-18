-- ============================================================
-- OptionOS — Remover temporariamente titular "Mãe" e tudo
-- relacionado (operações, posições de ações, comissões, saques,
-- patrimônio). No futuro, quando quiser reincluir, basta cadastrar
-- o titular de novo em Configurações.
--
-- Ordem importa: apaga primeiro o que referencia holder_id sem
-- cascade automático, depois o titular em si (que arrasta o resto
-- via cascade).
-- ============================================================

do $$
declare
  mae_id uuid;
begin
  select id into mae_id from holders where name = 'Mãe' limit 1;

  if mae_id is not null then
    -- Tabelas sem cascade automático: apaga manualmente primeiro.
    delete from operations where holder_id = mae_id;
    delete from equity_snapshots where holder_id = mae_id;

    -- Apaga o titular — arrasta stock_positions e withdrawals via
    -- "on delete cascade" já configurado nessas duas tabelas.
    delete from holders where id = mae_id;
  end if;
end $$;
