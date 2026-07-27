-- ============================================================
-- OptionOS — Migration 0020
-- Histórico de Vendas de Ações: registro permanente de toda baixa
-- em stock_positions causada por exercício de Covered Call — mesmo
-- depois da posição zerar, o registro continua existindo, para
-- histórico e gráficos (usuário pediu explicitamente que isso não
-- se perca quando a posição some).
-- ============================================================

create table stock_sale_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  holder_id uuid not null references holders(id),
  operation_id uuid references operations(id), -- a operação CALL que gerou o exercício
  quantity integer not null,
  average_price numeric(14,4) not null, -- PM de custo das ações vendidas
  strike numeric(14,4) not null, -- preço de venda (strike da CALL)
  gross_result numeric(14,2) not null, -- (strike - PM) × quantidade — pode ser negativo
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_stock_sale_history_asset on stock_sale_history(asset_id);
create index idx_stock_sale_history_holder on stock_sale_history(holder_id);

alter table stock_sale_history enable row level security;
create policy "allow all - stock_sale_history" on stock_sale_history for all using (true) with check (true);
