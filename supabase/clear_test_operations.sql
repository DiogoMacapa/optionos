-- ============================================================
-- OptionOS — Limpar todas as operações (exemplo + testes)
-- Roda uma vez, antes de inserir o histórico real.
-- ============================================================

delete from operations;

-- Opcional: também zera as posições de ações de exemplo, se quiser
-- recomeçar do zero em "Minhas Ações" também. Descomente se for o caso:
-- delete from stock_positions;
