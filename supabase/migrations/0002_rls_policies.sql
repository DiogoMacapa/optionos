-- ============================================================
-- OptionOS — Row Level Security
-- v1: single-user, sem autenticação. Acesso liberado via anon key.
-- Preparado para restringir por usuário quando auth for adicionado
-- (basta trocar "using (true)" por "using (auth.uid() = user_id)"
-- depois de adicionar a coluna user_id nas tabelas relevantes).
-- ============================================================

alter table assets enable row level security;
alter table market_snapshots enable row level security;
alter table option_chain_entries enable row level security;
alter table score_weights enable row level security;
alter table strategy_settings enable row level security;
alter table opportunities enable row level security;
alter table operations enable row level security;
alter table equity_snapshots enable row level security;

create policy "allow all - assets" on assets for all using (true) with check (true);
create policy "allow all - market_snapshots" on market_snapshots for all using (true) with check (true);
create policy "allow all - option_chain_entries" on option_chain_entries for all using (true) with check (true);
create policy "allow all - score_weights" on score_weights for all using (true) with check (true);
create policy "allow all - strategy_settings" on strategy_settings for all using (true) with check (true);
create policy "allow all - opportunities" on opportunities for all using (true) with check (true);
create policy "allow all - operations" on operations for all using (true) with check (true);
create policy "allow all - equity_snapshots" on equity_snapshots for all using (true) with check (true);
