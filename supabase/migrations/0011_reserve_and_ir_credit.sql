-- ============================================================
-- OptionOS — Migration 0011
-- Reserva de emergência (soma ao patrimônio, mas não opera) e
-- rastreamento de crédito de IR por prejuízo em operações fechadas.
-- ============================================================

alter table strategy_settings
  add column emergency_reserve numeric(14,2) not null default 0; -- "cofrinho do banco" — soma ao patrimônio, não é operável

-- View: crédito de IR acumulado por prejuízo em operações fechadas com
-- resultado negativo. Regra fiscal real (renda variável): prejuízo pode
-- compensar IR de ganhos futuros. Aqui só EXIBIMOS o crédito disponível —
-- o abatimento na declaração é feito manualmente pelo usuário, fora do sistema.
create or replace view ir_credit_summary as
select
  h.id as holder_id,
  h.name as holder_name,
  coalesce(sum(
    case when o.gross_result < 0 then abs(o.gross_result) * 0.15 else 0 end
  ), 0) as ir_credit_available,
  coalesce(sum(o.ir_amount) filter (where o.gross_result > 0), 0) as ir_paid_total
from holders h
left join operations o on o.holder_id = h.id and o.status in ('encerrada', 'exercida', 'rolada')
group by h.id, h.name;
