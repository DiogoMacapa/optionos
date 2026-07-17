-- ============================================================
-- OptionOS — Migration 0006
-- Persistência real da Calculadora (substitui localStorage).
-- Uma linha por operação sendo comparada, mais um registro de
-- caixa disponível — sincroniza entre dispositivos, sobrevive a
-- limpar dados do navegador, consistente com o resto do sistema.
-- ============================================================

create table calculator_rows (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,          -- ordem de exibição na tela

  ticker text not null default '',
  quote text not null default '',            -- guardado como texto (aceita ",80" etc, igual ao input)
  strike text not null default '',
  ceiling text not null default '',
  premium text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calculator_rows_position on calculator_rows(position);

create table calculator_settings (
  id uuid primary key default gen_random_uuid(),
  cash text not null default '150000',
  updated_at timestamptz not null default now()
);

-- Linha única de configurações (padrão já usado em strategy_settings)
insert into calculator_settings (cash) values ('150000');

create trigger trg_calculator_rows_updated_at
  before update on calculator_rows
  for each row execute function set_updated_at();

create trigger trg_calculator_settings_updated_at
  before update on calculator_settings
  for each row execute function set_updated_at();

alter table calculator_rows enable row level security;
alter table calculator_settings enable row level security;

create policy "allow all - calculator_rows" on calculator_rows for all using (true) with check (true);
create policy "allow all - calculator_settings" on calculator_settings for all using (true) with check (true);
