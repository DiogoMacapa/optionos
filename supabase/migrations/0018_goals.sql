-- ============================================================
-- OptionOS — Migration 0018
-- Objetivos: metas financeiras personalizáveis, com progresso
-- calculado automaticamente a partir dos dados já existentes no
-- sistema (Patrimônio Atual, lucro do mês corrente, etc).
--
-- target_type define de onde o progresso é lido:
--   'patrimonio'    -> compara com kpis.currentEquity (Patrimônio Atual)
--   'renda_mensal'  -> compara com a soma de net_profit das operações
--                      fechadas no mês corrente (renova todo mês)
--   'personalizado' -> progresso digitado manualmente pelo usuário
--                      (current_value), como o "Prejuízo a compensar"
-- ============================================================

create table goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_type text not null check (target_type in ('patrimonio', 'renda_mensal', 'personalizado')),
  target_value numeric(14,2) not null,
  deadline date,
  current_value numeric(14,2), -- só usado quando target_type = 'personalizado'
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_goals_active on goals(active);

alter table goals enable row level security;
create policy "allow all - goals" on goals for all using (true) with check (true);
