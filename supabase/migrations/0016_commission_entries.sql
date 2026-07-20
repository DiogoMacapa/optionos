-- ============================================================
-- OptionOS — Migration 0016
-- Lançamentos manuais de comissão (ex: comissão que o usuário ganha
-- gerenciando operações da conta da mãe) — entra como caixa, soma
-- ao Patrimônio, com histórico por data para gráfico de evolução.
-- ============================================================

create table commission_entries (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14,2) not null,
  received_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_commission_entries_date on commission_entries(received_at);

alter table commission_entries enable row level security;
create policy "allow all - commission_entries" on commission_entries for all using (true) with check (true);
