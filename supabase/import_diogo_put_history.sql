-- ============================================================
-- OptionOS — Importação em massa: histórico real de PUT (Diogo)
-- Extraído e validado matematicamente a partir do print da planilha
-- "Venda PUT - Diogo" (blocos Maio/Abril/Março 26).
-- Todos os valores derivados (Total Prêmio, Total Recompra,
-- Venda-Recompra, IR, Lucro Final, Eficiência) foram recalculados
-- e conferem exatamente com o que aparece no print original.
-- ============================================================

-- Garante que os ativos existem
insert into assets (ticker) values ('BPAC11') on conflict (ticker) do nothing;
insert into assets (ticker) values ('PRIO3') on conflict (ticker) do nothing;
insert into assets (ticker) values ('B3SA3') on conflict (ticker) do nothing;

insert into operations (
  asset_id, holder_id, option_type, strike, expiration, quantity,
  premium_received, week_label, reference_quote, option_symbol,
  opened_at, buyback_premium, close_price, net_profit, ir_amount,
  gross_result, efficiency_pct, exercised, exercised_label, status
)
select
  a.id, h.id, 'PUT', v.strike, v.expiration::date, v.quantity,
  v.premium_received, v.week_label, v.reference_quote, v.option_symbol,
  v.opened_at::date, v.buyback_premium, v.total_buyback, v.net_profit, v.ir_amount,
  v.gross_result, v.efficiency_pct, v.exercised, v.exercised_label, 'encerrada'
from holders h,
(values
  -- ticker_ativo, option_symbol, week_label, opened_at, quantity, strike, reference_quote, expiration,
  -- premium_received(total), buyback_premium(por ação), total_buyback, gross_result(venda-recompra),
  -- ir_amount, net_profit, efficiency_pct, exercised(bool), exercised_label
  ('BPAC11', 'BPACQ590W1', '04-08', '2026-05-04',  9100, 59.00, 56.18, '2026-05-08', 10738.00, 0.00,    0.00, 10738.00, 1610.70, 9127.30, 100.00, true,  'Sim'),
  ('BPAC11', 'BPACP570',   '06-10', '2026-04-06',  8800, 57.00, 56.18, '2026-04-10',  7568.00, 0.06,  528.00,  7040.00, 1056.00, 5984.00,  93.02, false, 'Rolagem'),
  ('PRIO3',  'PRIOP600W',  '06-10', '2026-04-08',  8500, 60.00, 57.85, '2026-04-10',  5695.00, 0.10,  850.00,  4845.00,  726.75, 4118.25,  85.07, false, 'Rolagem'),
  ('PRIO3',  'PRIOP650',   '06-10', '2026-04-09',  7900, 65.00, 57.85, '2026-04-10',  5135.00, 0.00,    0.00,  5135.00,  770.25, 4364.75, 100.00, false, 'Não'),
  ('PRIO3',  'PRIOP660',   '13-17', '2026-04-13',  7900, 66.00, 57.85, '2026-04-17', 10270.00, 0.00,    0.00, 10270.00, 1540.50, 8729.50, 100.00, true,  'Sim'),
  ('PRIO3',  'PRIOO590',   '16-20', '2026-03-16',  7800, 59.00, 57.85, '2026-03-20', 10140.00, 0.17, 1326.00,  8814.00, 1322.10, 7491.90,  86.92, false, 'Rolagem'),
  ('PRIO3',  'PRIOO640',   '16-20', '2026-03-18',  7200, 64.00, 57.85, '2026-03-20',  7488.00, 0.17, 1224.00,  6264.00,  939.60, 5324.40,  83.65, false, 'Rolagem'),
  ('PRIO3',  'PRIOO670',   '16-20', '2026-03-19',  7000, 67.00, 57.85, '2026-03-20',  4480.00, 0.00,    0.00,  4480.00,  672.00, 3808.00, 100.00, false, 'Não'),
  ('B3SA3',  'B3SAO166',   '23-27', '2026-03-23', 28700, 16.68, 15.20, '2026-03-27',  7462.00, 0.04, 1148.00,  6314.00,  947.10, 5366.90,  84.62, true,  'Sim'),
  ('BPAC11', 'BPACO570',   '23-27', '2026-03-25',  8500, 57.00, 56.18, '2026-03-27',  5100.00, 0.00,    0.00,  5100.00,  765.00, 4335.00, 100.00, true,  'Sim')
) as v(
  ticker_ativo, option_symbol, week_label, opened_at, quantity, strike, reference_quote, expiration,
  premium_received, buyback_premium, total_buyback, gross_result, ir_amount, net_profit, efficiency_pct,
  exercised, exercised_label
)
join assets a on a.ticker = v.ticker_ativo
where h.is_self = true;
