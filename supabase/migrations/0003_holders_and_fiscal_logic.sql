-- ============================================================
-- OptionOS — Migration 0003
-- Titulares (Diogo/Mãe), comissão, PM por posição, e correção
-- da lógica fiscal real validada com a planilha de origem:
--   - PUT:  Taxa = Prêmio/Strike   | IR = 15% sobre (Prêmio-Recompra)
--   - CALL: Taxa = Prêmio/Cotação  | IR = 15% sobre Prêmio bruto
-- ============================================================

-- ------------------------------------------------------------
-- TITULARES — quem é o dono real da operação (Diogo, Mãe, ...)
-- ------------------------------------------------------------
create table holders (
  id uuid primary key default gen_random_uuid(),
  name text not null,                          -- "Diogo", "Mãe"
  is_self boolean not null default false,       -- true = o próprio usuário do sistema
  commission_pct numeric(5,2) not null default 0,  -- % de comissão sobre o lucro final, se Diogo gerencia para essa pessoa
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into holders (name, is_self, commission_pct) values
  ('Diogo', true, 0),
  ('Mãe', false, 15);  -- ajuste o % real depois em Configurações

-- ------------------------------------------------------------
-- POSIÇÕES PRÓPRIAS (para Covered Call) — guarda o PM por ativo/titular
-- PM fica fixo entre ciclos de Call até a posição ser encerrada/exercida.
-- ------------------------------------------------------------
create table stock_positions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  holder_id uuid not null references holders(id) on delete cascade,

  quantity int not null,               -- quantidade de ações possuídas
  average_price numeric(12,4) not null,  -- PM

  active boolean not null default true,  -- false quando a posição é totalmente encerrada
  opened_at date not null default current_date,
  closed_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stock_positions_asset_holder on stock_positions(asset_id, holder_id) where active;

-- ------------------------------------------------------------
-- OPERATIONS — adiciona titular, posição vinculada (CALL), e
-- separa os campos fiscais de forma explícita por tipo de opção.
-- ------------------------------------------------------------
alter table operations
  add column holder_id uuid references holders(id),
  add column stock_position_id uuid references stock_positions(id),  -- só para CALL
  add column buyback_premium numeric(14,4),      -- prêmio de recompra por ação (não só o total)
  add column gross_result numeric(14,4),         -- Prêmio - Recompra (PUT) ou Prêmio+L/P se exercido (CALL)
  add column ir_base numeric(14,4),               -- base sobre a qual o IR incidiu (auditável)
  add column efficiency_pct numeric(5,2),         -- 1 - (Recompra/Prêmio), calculado e persistido
  add column commission_amount numeric(14,4) not null default 0;  -- comissão retida se holder != self

-- Backfill: operações existentes assumem o titular "Diogo" (is_self)
update operations set holder_id = (select id from holders where is_self = true limit 1)
where holder_id is null;

alter table operations alter column holder_id set not null;

-- ------------------------------------------------------------
-- SAQUES — registro manual de retiradas (não é fórmula fixa,
-- pois o valor sacado varia por operação: 100%, 50%, ou nada).
-- ------------------------------------------------------------
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  holder_id uuid not null references holders(id) on delete cascade,
  operation_id uuid references operations(id) on delete set null,  -- opcional: vincula a uma operação específica

  amount numeric(14,2) not null,
  withdrawn_at date not null default current_date,
  notes text,

  created_at timestamptz not null default now()
);

create index idx_withdrawals_holder on withdrawals(holder_id, withdrawn_at desc);

-- ------------------------------------------------------------
-- ESTRATÉGIAS NOMEADAS (glossário de táticas de rolagem, para a IA)
-- ------------------------------------------------------------
create table named_strategies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  applies_to text not null check (applies_to in ('PUT', 'CALL', 'AMBOS')),
  created_at timestamptz not null default now()
);

insert into named_strategies (name, description, applies_to) values
  (
    'Correndo atrás do gato',
    'Vende PUT a um prêmio, e caso a ação suba, zera a operação recomprando a um preço menor, capturando o lucro. Repete vendendo uma nova PUT com prêmio maior, recomprando de novo se a ação continuar subindo, até chegar a um strike confortável caso seja exercido.',
    'PUT'
  ),
  (
    'Rolagem (ganhar tempo)',
    'Quando uma opção está prestes a ser exercida: (1) verificar se há a mesma opção disponível para recompra; (2) verificar se existe uma opção do mês seguinte com prêmio suficiente para cobrir o prejuízo esperado da rolagem, e se possível gerar lucro; (3) recomprar a opção vendida (zerar), e em seguida vender a nova opção cujo prêmio cubra o prejuízo da recompra e ainda sobre lucro.',
    'AMBOS'
  );

-- ------------------------------------------------------------
-- Índice para consultas de rateio Diogo × Mãe (aba "$")
-- ------------------------------------------------------------
create index idx_operations_holder on operations(holder_id, status);
