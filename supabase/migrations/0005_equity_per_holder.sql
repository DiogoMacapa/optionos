-- ============================================================
-- OptionOS — Migration 0005
-- Patrimônio por titular (equity_snapshots ganha holder_id) e
-- consolidação de comissão pendente de saque.
--
-- Contexto: o usuário confirmou que TUDO no sistema deve ser
-- duplicado por titular (Diogo e Mãe têm patrimônios distintos),
-- e que ele precisa de um lugar para controlar quanto de comissão
-- já foi sacada e quanto ainda está pendente.
-- ============================================================

-- ------------------------------------------------------------
-- EQUITY_SNAPSHOTS — adicionar holder_id
-- ------------------------------------------------------------

-- Remove a constraint antiga que só permitia 1 registro por data (global)
alter table equity_snapshots drop constraint if exists equity_snapshots_recorded_at_key;

alter table equity_snapshots
  add column holder_id uuid references holders(id);

-- Backfill: snapshots existentes assumem o titular "Diogo" (is_self)
update equity_snapshots set holder_id = (select id from holders where is_self = true limit 1)
where holder_id is null;

alter table equity_snapshots alter column holder_id set not null;

-- Novo unique: um registro por titular por dia (em vez de um por dia, global)
alter table equity_snapshots add constraint equity_snapshots_holder_date_key unique (holder_id, recorded_at);

create index idx_equity_snapshots_holder on equity_snapshots(holder_id, recorded_at);

-- ------------------------------------------------------------
-- VIEW: comissão acumulada vs. sacada, por titular
-- (soma de operations.commission_amount menos soma de withdrawals
-- marcados como referentes a comissão)
-- ------------------------------------------------------------
create or replace view commission_summary as
select
  h.id as holder_id,
  h.name as holder_name,
  h.commission_pct,
  coalesce(sum(o.commission_amount) filter (where o.status in ('encerrada', 'exercida', 'rolada')), 0) as commission_earned,
  coalesce((
    select sum(w.amount) from withdrawals w
    where w.holder_id = h.id and w.notes ilike '%comiss%'
  ), 0) as commission_withdrawn
from holders h
left join operations o on o.holder_id = h.id
where h.is_self = false
group by h.id, h.name, h.commission_pct;
