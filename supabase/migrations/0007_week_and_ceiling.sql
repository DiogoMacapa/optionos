-- ============================================================
-- OptionOS — Migration 0007
-- Rótulo de "semana" (ex: "13-19") escolhido via calendário, e
-- preço-teto por ativo (Strike acima do teto = "Cara", vermelho).
-- ============================================================

alter table operations
  add column week_label text;  -- ex: "13-19" — dias da semana da operação, escolhidos no calendário

-- Preço-teto é característica do ATIVO (o usuário decide um teto por
-- papel, não por operação pontual) — fica junto com assets.
alter table assets
  add column ceiling_price numeric(12,4);  -- se o Strike de uma nova PUT ultrapassar isso, alerta "Cara"
