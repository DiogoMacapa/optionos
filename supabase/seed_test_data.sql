-- ============================================================
-- OptionOS — Dados fictícios para teste
-- Popula: posições em ações, operações (abertas/encerradas/
-- exercida/rolada) e histórico de patrimônio por titular.
--
-- Seguro rodar mais de uma vez: cada bloco limpa os dados de
-- teste anteriores (marcados com notes/observação específica)
-- antes de inserir de novo.
-- ============================================================

-- ------------------------------------------------------------
-- Limpeza de dados de teste anteriores (se já tiver rodado antes)
-- ------------------------------------------------------------
delete from operations where notes = 'seed-teste';
delete from stock_positions where opened_at = '2026-01-15';
delete from equity_snapshots where recorded_at in
  ('2026-02-10','2026-03-10','2026-04-10','2026-05-10','2026-06-10','2026-07-10');

-- ------------------------------------------------------------
-- Posições em ações (PM) — para Covered Call
-- ------------------------------------------------------------
insert into stock_positions (asset_id, holder_id, quantity, average_price, opened_at)
select a.id, h.id, 9100, 57.84, '2026-01-15'
from assets a, holders h
where a.ticker = 'BPAC11' and h.is_self = true;

insert into stock_positions (asset_id, holder_id, quantity, average_price, opened_at)
select a.id, h.id, 3600, 57.69, '2026-01-15'
from assets a, holders h
where a.ticker = 'BPAC11' and h.is_self = false;

-- ------------------------------------------------------------
-- Operações ABERTAS (para testar agrupamento por vencimento)
-- ------------------------------------------------------------

-- Vence em 3 dias — Diogo, PUT
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, opened_at, notes)
select a.id, h.id, 'PUT', 76.68, current_date + 3, 6300, 2709.00, 0.22, 483084.00, 'aberta', current_date - 4, 'seed-teste'
from assets a, holders h where a.ticker = 'VALE3' and h.is_self = true;

-- Vence em 3 dias — Diogo, CALL (sobre a posição de BPAC11)
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, opened_at, notes)
select a.id, h.id, 'CALL', 59.00, current_date + 3, 9100, 3731.00, 0.19, null, 'aberta', current_date - 4, 'seed-teste'
from assets a, holders h where a.ticker = 'BPAC11' and h.is_self = true;

-- Vence em 3 dias — Mãe, CALL (sobre a posição dela de BPAC11)
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, opened_at, notes)
select a.id, h.id, 'CALL', 58.50, current_date + 3, 3600, 1100.00, 0.20, null, 'aberta', current_date - 4, 'seed-teste'
from assets a, holders h where a.ticker = 'BPAC11' and h.is_self = false;

-- Vence em 10 dias — Diogo, PUT
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, opened_at, notes)
select a.id, h.id, 'PUT', 14.54, current_date + 10, 33800, 4732.00, 0.24, 491452.00, 'aberta', current_date - 2, 'seed-teste'
from assets a, holders h where a.ticker = 'B3SA3' and h.is_self = true;

-- Vence em 10 dias — Mãe, PUT
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, opened_at, notes, commission_amount)
select a.id, h.id, 'PUT', 28.00, current_date + 10, 4000, 1180.00, 0.22, 112000.00, 'aberta', current_date - 2, 'seed-teste', 0
from assets a, holders h where a.ticker = 'PETR4' and h.is_self = false;

-- ------------------------------------------------------------
-- Operações ENCERRADAS (histórico, com resultado)
-- ------------------------------------------------------------

-- PUT recomprada com lucro — Diogo
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, closed_at, close_price, net_profit, ir_amount, gross_result, ir_base, efficiency_pct, opened_at, notes)
select a.id, h.id, 'PUT', 60.00, current_date - 20, 8500, 5695.00, 0.25, 510000.00, 'encerrada', current_date - 22, 850.00, 4118.25, 726.75, 4845.00, 4845.00, 85.07, current_date - 27, 'seed-teste'
from assets a, holders h where a.ticker = 'PRIO3' and h.is_self = true;

-- PUT expirada sem valor (100% eficiência) — Diogo
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, closed_at, close_price, net_profit, ir_amount, gross_result, ir_base, efficiency_pct, opened_at, notes)
select a.id, h.id, 'PUT', 59.00, current_date - 35, 9100, 10738.00, 0.18, 536900.00, 'encerrada', current_date - 35, 0, 9127.30, 1610.70, 10738.00, 10738.00, 100.00, current_date - 42, 'seed-teste'
from assets a, holders h where a.ticker = 'BPAC11' and h.is_self = true;

-- CALL exercida (resultado negativo pela venda abaixo do PM) — Diogo
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, closed_at, close_price, net_profit, ir_amount, gross_result, ir_base, efficiency_pct, exercised, opened_at, notes)
select a.id, h.id, 'CALL', 53.05, current_date - 50, 9100, 3731.00, 0.30, null, 'exercida', current_date - 50, 0, -33879.30, 0, -39858.00, -39858.00, 100.00, true, current_date - 57, 'seed-teste'
from assets a, holders h where a.ticker = 'BPAC11' and h.is_self = true;

-- ------------------------------------------------------------
-- Operações ENCERRADAS — Mãe (menor escala, com comissão de 15%)
-- ------------------------------------------------------------
insert into operations (asset_id, holder_id, option_type, strike, expiration, quantity, premium_received, delta_at_open, committed_capital, status, closed_at, close_price, net_profit, ir_amount, gross_result, ir_base, efficiency_pct, commission_amount, opened_at, notes)
select a.id, h.id, 'PUT', 22.00, current_date - 18, 2500, 875.00, 0.21, 55000.00, 'encerrada', current_date - 18, 0, 743.75, 131.25, 875.00, 875.00, 100.00, 111.56, current_date - 25, 'seed-teste'
from assets a, holders h where a.ticker = 'BBAS3' and h.is_self = false;

-- ------------------------------------------------------------
-- Patrimônio por titular (6 meses, dia 10 de cada mês)
-- ------------------------------------------------------------

-- Diogo
insert into equity_snapshots (recorded_at, holder_id, total_equity, free_cash, committed_capital, cumulative_premiums, cumulative_profit)
select v.d::date, h.id, v.equity, v.cash, v.committed, v.premiums, v.profit
from holders h,
(values
  ('2026-02-10', 340000, 30000, 310000, 6200, 4800),
  ('2026-03-10', 350000, 25000, 325000, 15100, 12000),
  ('2026-04-10', 357000, 37000, 320000, 22200, 17100),
  ('2026-05-10', 362000, 21000, 341000, 32500, 25000),
  ('2026-06-10', 370000, 42000, 328000, 40900, 23500),
  ('2026-07-10', 378600, 33000, 345600, 46100, 27600)
) as v(d, equity, cash, committed, premiums, profit)
where h.is_self = true;

-- Mãe
insert into equity_snapshots (recorded_at, holder_id, total_equity, free_cash, committed_capital, cumulative_premiums, cumulative_profit)
select v.d::date, h.id, v.equity, v.cash, v.committed, v.premiums, v.profit
from holders h,
(values
  ('2026-02-10', 140000, 15000, 125000, 2300, 1400),
  ('2026-03-10', 145000, 13000, 132000, 5700, 4000),
  ('2026-04-10', 148000, 15000, 133000, 8400, 6000),
  ('2026-05-10', 150000, 10000, 140000, 12300, 9000),
  ('2026-06-10', 154000, 18000, 136000, 15500, 8500),
  ('2026-07-10', 155000, 11000, 144000, 17700, 10300)
) as v(d, equity, cash, committed, premiums, profit)
where h.is_self = false;
