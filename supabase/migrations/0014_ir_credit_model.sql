-- ============================================================
-- OptionOS — Migration 0014
-- Corrige o modelo de Crédito de IR (a view anterior calculava
-- 15% do prejuízo, o que estava errado — não existe "15% de
-- prejuízo"; o crédito é o valor INTEGRAL do prejuízo, que abate
-- o LUCRO BRUTO de operações futuras antes de aplicar os 15%).
--
--   ir_credit_generated: crédito editável, gerado por operação com
--   prejuízo (pré-calculado como abs(resultado), mas o usuário pode
--   ajustar manualmente).
--
--   ir_credit_usage: registro manual de "usei R$X desse crédito
--   no mês Y" — controlado pelo usuário, não automático.
-- ============================================================

alter table operations
  add column ir_credit_generated numeric(14,2); -- null = não gerou crédito (operação com lucro)

-- Backfill: operações já fechadas com resultado negativo geram
-- crédito automaticamente = valor absoluto do resultado.
update operations
set ir_credit_generated = abs(gross_result)
where gross_result < 0 and status in ('encerrada', 'exercida', 'rolada');

create table ir_credit_usage (
  id uuid primary key default gen_random_uuid(),
  holder_id uuid not null references holders(id) on delete cascade,
  amount numeric(14,2) not null,
  used_at date not null default current_date, -- mês/data em que o crédito foi abatido
  notes text,
  created_at timestamptz not null default now()
);

create index idx_ir_credit_usage_holder on ir_credit_usage(holder_id, used_at desc);

alter table ir_credit_usage enable row level security;
create policy "allow all - ir_credit_usage" on ir_credit_usage for all using (true) with check (true);

-- Substitui a view antiga (que calculava errado) por uma que soma
-- o crédito real gerado por operação, por titular.
drop view if exists ir_credit_summary;

create or replace view ir_credit_summary as
select
  h.id as holder_id,
  h.name as holder_name,
  coalesce((
    select sum(o.ir_credit_generated) from operations o
    where o.holder_id = h.id and o.ir_credit_generated is not null
  ), 0) as ir_credit_generated_total,
  coalesce((
    select sum(u.amount) from ir_credit_usage u
    where u.holder_id = h.id
  ), 0) as ir_credit_used_total
from holders h;
