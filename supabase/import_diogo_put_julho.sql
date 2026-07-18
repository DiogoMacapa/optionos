-- ============================================================
-- OptionOS — Importação em massa: histórico real de PUT (Diogo)
-- Bloco PUT - JULHO 26, extraído e validado do print da planilha.
-- ============================================================

insert into assets (ticker) values ('VALE3') on conflict (ticker) do nothing;
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
  ('VALE3', 'VALES76',  '29-03', '2026-06-29',  6300, 76.68, 72.94, '2026-07-03', 2709.00, 0.01,  63.00, 2646.00, 396.90, 2249.10,  97.67, false, 'Rolagem'),
  ('B3SA3', 'B3SAS14',  '03-10', '2026-07-03', 33800, 14.54, 15.20, '2026-07-10', 4732.00, 0.00,   0.00, 4732.00, 709.80, 4022.20, 100.00, false, 'Não'),
  ('B3SA3', 'B3SAS14',  '13-17', '2026-07-13', 33700, 14.71, 15.20, '2026-07-17', 5055.00, 0.00,   0.00, 5055.00, 758.25, 4296.75, 100.00, false, 'Não')
) as v(
  ticker_ativo, option_symbol, week_label, opened_at, quantity, strike, reference_quote, expiration,
  premium_received, buyback_premium, total_buyback, gross_result, ir_amount, net_profit, efficiency_pct,
  exercised, exercised_label
)
join assets a on a.ticker = v.ticker_ativo
where h.is_self = true;
