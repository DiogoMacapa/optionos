-- ============================================================
-- OptionOS — Importação em massa: histórico real de CALL (Diogo)
-- Extraído e validado matematicamente a partir do print da planilha
-- "Venda Call - Diogo" (blocos Junho/Maio/Abril/Março-Abril 26).
--
-- Regra fiscal aplicada (validada e confirmada com o usuário):
--   - Não exercida: IR = 15% sobre o Total Prêmio bruto
--   - Exercida: IR = 15% sobre (Total Prêmio + (Strike-PM)×Qtd),
--     nunca negativo (prejuízo não gera "crédito automático" —
--     vira apenas resultado negativo, sem IR)
--
-- Todas marcadas como histórico (counts_toward_equity = false):
-- o Patrimônio Inicial do usuário já reflete o resultado destas
-- operações, evitando contagem duplicada.
-- ============================================================

insert into assets (ticker) values ('BPAC11') on conflict (ticker) do nothing;
insert into assets (ticker) values ('PRIO3') on conflict (ticker) do nothing;

insert into operations (
  asset_id, holder_id, option_type, strike, expiration, quantity,
  premium_received, week_label, reference_quote, option_symbol,
  opened_at, close_price, net_profit, ir_amount, gross_result,
  efficiency_pct, exercised, exercised_label, status, counts_toward_equity
)
select
  a.id, h.id, 'CALL', v.strike, v.expiration::date, v.quantity,
  v.premium_received, v.week_label, v.reference_quote, v.option_symbol,
  v.opened_at::date, v.total_buyback, v.net_profit, v.ir_amount, v.gross_result,
  v.efficiency_pct, v.exercised, v.exercised_label, 'encerrada', false
from holders h,
(values
  -- ticker_ativo, option_symbol, week_label, opened_at, quantity, strike, reference_quote, expiration,
  -- premium_received(total), total_buyback, gross_result(resultado), ir_amount, net_profit, efficiency_pct,
  -- exercised(bool), exercised_label
  ('BPAC11', 'BPACF565W1', '25-05', '2026-05-28', 9100, 56.50, 58.73, '2026-06-05',  3367.00,  364.00,   3003.00,  505.05,   2497.95,  89.19, false, 'Rolagem'),
  ('BPAC11', 'BPACF540W1', '01-05', '2026-06-01', 9100, 54.00, 58.73, '2026-06-05',  2548.00,  273.00,   2275.00,  382.20,   1892.80,  89.29, false, 'Rolagem'),
  ('BPAC11', 'BPACF535W1', '01-12', '2026-06-03', 9100, 53.50, 58.73, '2026-06-12',  2548.00,  182.00,   2366.00,  382.20,   1983.80,  92.86, false, 'Rolagem'),
  ('BPAC11', 'BPACF515',   '08-19', '2026-06-10', 9100, 51.55, 58.73, '2026-06-19',  3276.00, 4823.00,  -1547.00,  491.40,  -2038.40, -47.22, false, 'Rolagem'),
  ('BPAC11', 'BPACF530W4', '15-26', '2026-06-17', 9100, 53.05, 58.73, '2026-06-26',  3731.00,    0.00, -39858.00,    0.00, -39858.00, 100.00, true,  'Sim'),
  ('BPAC11', 'BPACE570',   '11-15', '2026-05-13', 9100, 57.05, 58.73, '2026-05-15',  1547.00,    0.00,   1547.00,  232.05,   1314.95, 100.00, false, 'Não'),
  ('BPAC11', 'BPACE555W',  '18-22', '2026-05-18', 9100, 55.55, 58.73, '2026-05-22',  2912.00,    0.00,   2912.00,  436.80,   2475.20, 100.00, false, 'Não'),
  ('PRIO3',  'PRIOD640W',  '20-24', '2026-04-23', 7900, 64.00, 55.45, '2026-04-24',  3081.00,    0.00,   3081.00,  462.15,   2618.85, 100.00, false, 'Não'),
  ('PRIO3',  'PRIOD650W',  '27-30', '2026-04-27', 7900, 65.00, 55.45, '2026-04-30',  8295.00,    0.00,  10507.00, 1576.05,   8930.95, 100.00, true,  'Sim'),
  ('BPAC11', 'BPACD565W1', '30-02', '2026-04-01', 8500, 56.50, 58.73, '2026-04-02', 13600.00,    0.00,  14280.00, 2142.00,  12138.00, 100.00, true,  'Sim')
) as v(
  ticker_ativo, option_symbol, week_label, opened_at, quantity, strike, reference_quote, expiration,
  premium_received, total_buyback, gross_result, ir_amount, net_profit, efficiency_pct,
  exercised, exercised_label
)
join assets a on a.ticker = v.ticker_ativo
where h.is_self = true;
