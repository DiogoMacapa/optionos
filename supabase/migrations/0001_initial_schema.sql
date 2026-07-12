-- ============================================================
-- OptionOS — Schema inicial
-- Assistente para venda de PUT Cash Secured e Covered Call
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ATIVOS ACOMPANHADOS
-- ------------------------------------------------------------
create table assets (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,             -- ex: VALE3
  name text,                                -- ex: Vale S.A.
  sector text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SNAPSHOTS DE MERCADO
-- Cada print de gráfico importado vira um snapshot.
-- ------------------------------------------------------------
create table market_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  captured_at timestamptz not null default now(),  -- quando o print foi tirado/importado
  source text not null default 'investing',        -- investing | btg | manual

  -- Preço
  last_price numeric(12,4),
  change_abs numeric(12,4),
  change_pct numeric(8,4),

  -- Faixas
  day_low numeric(12,4),
  day_high numeric(12,4),
  week52_low numeric(12,4),
  week52_high numeric(12,4),

  -- OHLC do candle mais recente
  open_price numeric(12,4),
  high_price numeric(12,4),
  low_price numeric(12,4),
  close_price numeric(12,4),

  -- Indicadores técnicos (nullable — nem sempre disponíveis no print)
  volume bigint,
  ema9 numeric(12,4),
  ema21 numeric(12,4),
  sma50 numeric(12,4),
  bb_upper numeric(12,4),
  bb_middle numeric(12,4),
  bb_lower numeric(12,4),
  rsi14 numeric(6,2),
  macd_line numeric(12,4),
  macd_signal numeric(12,4),
  macd_histogram numeric(12,4),

  -- Interpretação (preenchido manualmente ou inferido)
  trend text,  -- alta | baixa | lateral

  -- Rastreabilidade do OCR
  source_image_ref text,        -- referência/nome do print original
  ocr_confidence numeric(4,3),  -- 0 a 1, confiança média da extração
  raw_ocr_text text,            -- texto bruto extraído, para auditoria/debug
  manually_confirmed boolean not null default false,

  created_at timestamptz not null default now()
);

create index idx_market_snapshots_asset on market_snapshots(asset_id, captured_at desc);

-- ------------------------------------------------------------
-- BOOK DE OPÇÕES — cada linha extraída de um print do book
-- ------------------------------------------------------------
create table option_chain_entries (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  snapshot_id uuid references market_snapshots(id) on delete set null,

  option_type text not null check (option_type in ('PUT', 'CALL')),
  strike numeric(12,4) not null,
  expiration date not null,

  premium numeric(12,4) not null,       -- prêmio (normalmente = bid, para venda)
  bid numeric(12,4),
  ask numeric(12,4),
  delta numeric(6,4),                    -- -1 a 1
  implied_volatility numeric(8,4),
  open_interest bigint,
  daily_volume bigint,

  captured_at timestamptz not null default now(),
  source_image_ref text,
  ocr_confidence numeric(4,3),
  raw_ocr_text text,
  manually_confirmed boolean not null default false,

  created_at timestamptz not null default now()
);

create index idx_option_chain_asset_exp on option_chain_entries(asset_id, expiration);
create index idx_option_chain_snapshot on option_chain_entries(snapshot_id);

-- ------------------------------------------------------------
-- PESOS DO SCORE (configurável pelo usuário)
-- ------------------------------------------------------------
create table score_weights (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'default',
  is_active boolean not null default true,

  weight_delta numeric(4,3) not null default 0.25,
  weight_premium numeric(4,3) not null default 0.25,
  weight_strike_distance numeric(4,3) not null default 0.20,
  weight_liquidity numeric(4,3) not null default 0.15,
  weight_spread numeric(4,3) not null default 0.10,
  weight_history numeric(4,3) not null default 0.05,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CONFIGURAÇÕES DE ESTRATÉGIA
-- ------------------------------------------------------------
create table strategy_settings (
  id uuid primary key default gen_random_uuid(),
  max_delta numeric(4,3) not null default 0.30,
  min_delta numeric(4,3) not null default 0.05,
  available_cash numeric(14,2),
  max_concentration_pct numeric(5,2) default 100,  -- % máx do caixa em 1 operação
  min_days_to_expiration int default 1,
  max_days_to_expiration int default 10,
  preferred_otm_only boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- OPORTUNIDADES (ranking calculado sobre option_chain_entries)
-- ------------------------------------------------------------
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  option_chain_entry_id uuid not null references option_chain_entries(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,

  score numeric(5,2) not null,        -- 0 a 100
  stars numeric(2,1) not null,        -- 0 a 5
  efficiency_pct numeric(5,2) not null,  -- 0 a 100

  -- Breakdown do score (para transparência/debug)
  score_breakdown jsonb,

  weights_used_id uuid references score_weights(id),

  status text not null default 'ativa' check (status in ('ativa', 'expirada', 'convertida', 'descartada')),

  created_at timestamptz not null default now()
);

create index idx_opportunities_score on opportunities(score desc) where status = 'ativa';
create index idx_opportunities_entry on opportunities(option_chain_entry_id);

-- ------------------------------------------------------------
-- OPERAÇÕES (o que foi de fato aberto)
-- ------------------------------------------------------------
create table operations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,

  option_type text not null check (option_type in ('PUT', 'CALL')),
  strike numeric(12,4) not null,
  expiration date not null,
  quantity int not null,               -- número de contratos

  premium_received numeric(14,4) not null,   -- prêmio total recebido na abertura
  delta_at_open numeric(6,4),

  committed_capital numeric(14,2),      -- capital comprometido (strike * qtd * 100, se PUT)

  status text not null default 'aberta' check (status in ('aberta', 'encerrada', 'rolada', 'exercida')),

  -- Fechamento
  closed_at timestamptz,
  close_price numeric(12,4),            -- prêmio pago para recomprar (0 se expirou sem valor)
  net_profit numeric(14,4),
  ir_amount numeric(14,4),

  -- Rolagem
  rolled_to_operation_id uuid references operations(id),
  rolled_from_operation_id uuid references operations(id),

  -- Exercício
  exercised boolean not null default false,

  opened_at timestamptz not null default now(),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_operations_status on operations(status);
create index idx_operations_asset on operations(asset_id);
create index idx_operations_expiration on operations(expiration);

-- ------------------------------------------------------------
-- HISTÓRICO PATRIMONIAL (para gráficos de evolução)
-- ------------------------------------------------------------
create table equity_snapshots (
  id uuid primary key default gen_random_uuid(),
  recorded_at date not null unique,
  total_equity numeric(14,2) not null,       -- patrimônio total
  free_cash numeric(14,2) not null,          -- caixa livre
  committed_capital numeric(14,2) not null,  -- capital comprometido
  cumulative_premiums numeric(14,2) not null,-- prêmios acumulados
  cumulative_profit numeric(14,2) not null,  -- lucro acumulado
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TRIGGERS: updated_at automático
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_operations_updated_at
  before update on operations
  for each row execute function set_updated_at();

create trigger trg_score_weights_updated_at
  before update on score_weights
  for each row execute function set_updated_at();

create trigger trg_strategy_settings_updated_at
  before update on strategy_settings
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- SEEDS iniciais
-- ------------------------------------------------------------
insert into score_weights (name, is_active) values ('default', true);
insert into strategy_settings (max_delta, min_delta) values (0.30, 0.05);

insert into assets (ticker, name, sector) values
  ('PETR4', 'Petrobras PN', 'Energia'),
  ('VALE3', 'Vale ON', 'Mineração'),
  ('BBAS3', 'Banco do Brasil ON', 'Financeiro'),
  ('B3SA3', 'B3 ON', 'Financeiro'),
  ('ITUB4', 'Itaú Unibanco PN', 'Financeiro'),
  ('BPAC11', 'BTG Pactual Unit', 'Financeiro'),
  ('PRIO3', 'PetroRio ON', 'Energia');
