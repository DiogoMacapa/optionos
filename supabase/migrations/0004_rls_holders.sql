-- ============================================================
-- OptionOS — RLS para tabelas da migration 0003
-- Mesmo padrão v1: single-user, sem auth (anon key liberada).
-- ============================================================

alter table holders enable row level security;
alter table stock_positions enable row level security;
alter table withdrawals enable row level security;
alter table named_strategies enable row level security;

create policy "allow all - holders" on holders for all using (true) with check (true);
create policy "allow all - stock_positions" on stock_positions for all using (true) with check (true);
create policy "allow all - withdrawals" on withdrawals for all using (true) with check (true);
create policy "allow all - named_strategies" on named_strategies for all using (true) with check (true);
