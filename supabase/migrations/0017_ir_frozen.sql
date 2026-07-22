-- ============================================================
-- OptionOS — Migration 0017
-- Interruptor "IR congelado": enquanto ativo, nenhuma operação nova
-- desconta IR (Lucro Líquido = Lucro Bruto). Usuário liga/desliga
-- manualmente em Configurações — usado enquanto ele ainda tem
-- prejuízo acumulado a compensar (controlado no app externo de IR),
-- evitando pagar IR duas vezes sobre o mesmo período.
-- ============================================================

alter table strategy_settings
  add column ir_frozen boolean not null default false;
