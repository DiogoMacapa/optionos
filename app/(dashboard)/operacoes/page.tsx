'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Briefcase, Plus } from 'lucide-react';
import { MonthExpirationGroup, groupByExpirationMonth } from '@/components/operations/month-expiration-group';
import { PutOperationsTable } from '@/components/operations/put-operations-table';
import { CallOperationsTable } from '@/components/operations/call-operations-table';
import { CloseOperationDialog } from '@/components/operations/close-operation-dialog';
import { MyStocksTab } from '@/components/operations/my-stocks-tab';
import { MarketStatusBadge } from '@/components/shared/market-status-badge';
import {
  listOperations,
  closeOperation,
  rollOperation,
  getStockPosition,
  upsertStockPosition,
  createOperation,
  getSelfHolder,
  findOrCreateAsset,
  listWithdrawals,
  getStrategySettings,
  updateOperationFields,
  type CloseOperationInput,
  type NewOperationInput,
} from '@/lib/supabase/queries';
import type { Operation, Withdrawal, StrategySettings } from '@/lib/types/database';
import { findOperationsNeedingExerciseCheck, shouldMarkAsExercised } from '@/lib/market-hours/exercise-check';

export default function OperacoesPage() {
  const [mainTab, setMainTab] = useState<'operacoes' | 'acoes'>('operacoes');
  const [subTab, setSubTab] = useState<'PUT' | 'CALL'>('PUT');
  const [operations, setOperations] = useState<Operation[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holderFilter, setHolderFilter] = useState<string | 'todos'>('todos');
  const [closingOp, setClosingOp] = useState<Operation | null>(null);
  const [closingOpAveragePrice, setClosingOpAveragePrice] = useState<number | null>(null);
  const [addingOperation, setAddingOperation] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ops, wds, settings] = await Promise.all([listOperations(), listWithdrawals(), getStrategySettings()]);
      setOperations(ops);
      setWithdrawals(wds);
      setStrategySettings(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar operações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ops, wds, settings] = await Promise.all([listOperations(), listWithdrawals(), getStrategySettings()]);
        if (!cancelled) {
          setOperations(ops);
          setWithdrawals(wds);
          setStrategySettings(settings);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar operações.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const withdrawalsByOperation = useMemo(() => {
    const map: Record<string, Withdrawal> = {};
    for (const w of withdrawals) {
      if (w.operation_id) map[w.operation_id] = w;
    }
    return map;
  }, [withdrawals]);

  // Verificação automática de exercício: ao carregar a tela, checa
  // operações com vencimento já passado e ainda sem "Exercido?"
  // classificado. Busca a cotação de fechamento e marca "Sim" só se
  // realmente ITM — nunca marca "Não" sozinho (usuário decide o
  // resto manualmente, como combinado). Roda uma vez por carregamento
  // de tela, não em toda atualização, para não gastar cota da API
  // à toa.
  const [autoCheckedIds, setAutoCheckedIds] = useState<Set<string>>(new Set());
  const [autoCheckResult, setAutoCheckResult] = useState<string | null>(null);

  useEffect(() => {
    if (loading || operations.length === 0) return;
    const candidates = findOperationsNeedingExerciseCheck(operations).filter((op) => !autoCheckedIds.has(op.id));
    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      const markedTickers: string[] = [];
      for (const op of candidates) {
        if (cancelled) return;
        const ticker = op.asset?.ticker;
        if (!ticker) continue;
        try {
          const res = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const closingQuote = Number(data.price);
          if (!Number.isFinite(closingQuote)) continue;
          if (shouldMarkAsExercised(op, closingQuote)) {
            await updateOperationFields(op.id, { exercised_label: 'Sim', reference_quote: closingQuote });
            markedTickers.push(ticker);
          }
        } catch {
          // Falha silenciosa por operação — não trava a checagem das demais.
        }
      }
      if (cancelled) return;
      setAutoCheckedIds((prev) => new Set([...prev, ...candidates.map((c) => c.id)]));
      if (markedTickers.length > 0) {
        setAutoCheckResult(`Marcado como exercido automaticamente: ${markedTickers.join(', ')} (confira e ajuste se precisar).`);
        await refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, operations, autoCheckedIds, refresh]);

  const filteredByHolder = useMemo(
    () => (holderFilter === 'todos' ? operations : operations.filter((o) => o.holder_id === holderFilter)),
    [operations, holderFilter]
  );

  const holders = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of operations) {
      if (o.holder) map.set(o.holder.id, o.holder.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [operations]);

  const putOps = useMemo(() => filteredByHolder.filter((o) => o.option_type === 'PUT'), [filteredByHolder]);
  const callOps = useMemo(() => filteredByHolder.filter((o) => o.option_type === 'CALL'), [filteredByHolder]);

  const putGrouped = useMemo(() => groupByExpirationMonth(putOps), [putOps]);
  const callGrouped = useMemo(() => groupByExpirationMonth(callOps), [callOps]);

  const activeTabOps = subTab === 'PUT' ? putOps : callOps;
  const activeOpenCount = activeTabOps.filter((o) => o.status === 'aberta').length;
  const activeTotalPremium = activeTabOps.reduce((sum, o) => sum + o.premium_received, 0);
  const activeCommittedCapital = activeTabOps
    .filter((o) => o.status === 'aberta' && o.option_type === 'PUT')
    .reduce((sum, o) => sum + o.strike * o.quantity, 0);

  async function handleClose(input: CloseOperationInput) {
    await closeOperation(input);

    // Se foi uma PUT exercida, o usuário comprou as ações ao Strike —
    // atualiza (ou cria) a posição em Minhas Ações automaticamente,
    // recalculando o preço médio ponderado se já existir uma posição
    // do mesmo ativo (confirmado com o usuário: junta com a existente,
    // não é uma posição nova separada).
    if (input.exercised && closingOp && closingOp.option_type === 'PUT') {
      try {
        const existing = await getStockPosition(closingOp.asset_id, closingOp.holder_id);
        const existingQty = existing?.quantity ?? 0;
        const existingAvg = existing?.average_price ?? 0;
        const newQty = closingOp.quantity;
        // Custo real de aquisição: Strike menos o prêmio recebido por ação
        // (o prêmio já embolsado reduz o custo efetivo de compra — não é
        // simplesmente o Strike bruto, senão o preço médio ficaria inflado).
        const premiumPerShare = newQty > 0 ? closingOp.premium_received / newQty : 0;
        const newPrice = closingOp.strike - premiumPerShare;

        const totalQty = existingQty + newQty;
        const weightedAverage = totalQty > 0 ? (existingQty * existingAvg + newQty * newPrice) / totalQty : 0;

        await upsertStockPosition({
          assetId: closingOp.asset_id,
          holderId: closingOp.holder_id,
          quantity: totalQty,
          averagePrice: Math.round(weightedAverage * 10000) / 10000,
        });
      } catch {
        // Se falhar (ex: rede), não bloqueia o encerramento da operação em si —
        // o usuário sempre pode ajustar Minhas Ações manualmente depois.
      }
    }

    setClosingOp(null);
    setClosingOpAveragePrice(null);
    await refresh();
  }

  async function handleRoll(buybackCost: number, newOperation: NewOperationInput) {
    if (!closingOp) return;
    await rollOperation({ originalId: closingOp.id, newOperation, buybackCost });
    setClosingOp(null);
    setClosingOpAveragePrice(null);
    await refresh();
  }

  async function handleOpenClose(op: Operation) {
    setClosingOp(op);
    if (op.option_type === 'CALL') {
      try {
        const position = await getStockPosition(op.asset_id, op.holder_id);
        setClosingOpAveragePrice(position?.average_price ?? null);
      } catch {
        setClosingOpAveragePrice(null);
      }
    } else {
      setClosingOpAveragePrice(null);
    }
  }

  /**
   * Cria uma operação em branco (valores mínimos) para o usuário
   * preencher diretamente na tabela — mesmo fluxo de edição inline já
   * usado nas linhas existentes, sem formulário separado.
   */
  async function handleAddOperation(optionType: 'PUT' | 'CALL') {
    setAddingOperation(true);
    try {
      const [holder, asset] = await Promise.all([getSelfHolder(), findOrCreateAsset('NOVO')]);
      const today = new Date().toISOString().slice(0, 10);
      await createOperation({
        assetId: asset.id,
        holderId: holder.id,
        opportunityId: null,
        optionType,
        strike: 0,
        expiration: today,
        quantity: 0,
        premiumReceived: 0,
        deltaAtOpen: null,
        committedCapital: null,
      });
      await refresh();
    } finally {
      setAddingOperation(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Operações</h1>
          <p className="text-sm text-muted-foreground">Agrupadas por mês de vencimento — fiel à sua planilha, com automações.</p>
        </div>
        <MarketStatusBadge />
      </div>

      {autoCheckResult && (
        <div className="flex items-center justify-between rounded-lg border border-warning/25 bg-warning-muted px-4 py-2 text-xs text-warning">
          <span>{autoCheckResult}</span>
          <button onClick={() => setAutoCheckResult(null)} className="text-warning/70 hover:text-warning">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setMainTab('operacoes')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mainTab === 'operacoes' ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Operações
            </button>
            <button
              onClick={() => setMainTab('acoes')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mainTab === 'acoes' ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Minhas Ações
            </button>
          </div>

          {mainTab === 'operacoes' && (
            <button
              onClick={() => handleAddOperation(subTab)}
              disabled={addingOperation}
              className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-muted px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {addingOperation ? 'Adicionando…' : `Adicionar operação ${subTab}`}
            </button>
          )}
        </div>

        {mainTab === 'operacoes' && (
          <div className="flex items-center gap-2">
            {holders.length > 1 && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
                <button
                  onClick={() => setHolderFilter('todos')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    holderFilter === 'todos' ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
                  }`}
                >
                  Todos
                </button>
                {holders.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setHolderFilter(h.id)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      holderFilter === h.id ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
              <button
                onClick={() => setSubTab('PUT')}
                className={`rounded-md px-4 py-1.5 text-xs font-bold transition-colors ${
                  subTab === 'PUT' ? 'bg-info/15 text-info' : 'text-muted-foreground hover:bg-surface-hover'
                }`}
              >
                PUT
              </button>
              <button
                onClick={() => setSubTab('CALL')}
                className={`rounded-md px-4 py-1.5 text-xs font-bold transition-colors ${
                  subTab === 'CALL' ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
                }`}
              >
                CALL
              </button>
            </div>
          </div>
        )}
      </div>

      {mainTab === 'operacoes' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">Abertas</span>
            <span className="font-tabular text-sm font-semibold text-foreground">{activeOpenCount}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">Prêmio total</span>
            <span className="font-tabular text-sm font-semibold text-accent">
              {activeTotalPremium.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          {subTab === 'PUT' && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">Garantia comprometida</span>
                <span className="font-tabular text-sm font-semibold text-foreground">
                  {activeCommittedCapital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {mainTab === 'acoes' ? (
        <MyStocksTab />
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
          )}

          {subTab === 'PUT' && (
            <>
              {!loading && putOps.length === 0 && !error && (
                <EmptyState label="Nenhuma operação de PUT ainda." />
              )}
              <div className="flex flex-col gap-3">
                {putGrouped.map((g, i) => (
                  <MonthExpirationGroup
                    key={`${g.year}-${g.month}`}
                    year={g.year}
                    month={g.month}
                    operations={g.operations}
                    defaultOpen={i === putGrouped.length - 1}
                  >
                    <PutOperationsTable
                      operations={g.operations}
                      withdrawalsByOperation={withdrawalsByOperation}
                      irFrozen={strategySettings?.ir_frozen ?? false}
                      onChanged={refresh}
                      onClose={handleOpenClose}
                    />
                  </MonthExpirationGroup>
                ))}
              </div>
            </>
          )}

          {subTab === 'CALL' && (
            <>
              {!loading && callOps.length === 0 && !error && (
                <EmptyState label="Nenhuma operação de CALL ainda." />
              )}
              <div className="flex flex-col gap-3">
                {callGrouped.map((g, i) => (
                  <MonthExpirationGroup
                    key={`${g.year}-${g.month}`}
                    year={g.year}
                    month={g.month}
                    operations={g.operations}
                    defaultOpen={i === callGrouped.length - 1}
                  >
                    <CallOperationsTable
                      operations={g.operations}
                      withdrawalsByOperation={withdrawalsByOperation}
                      irFrozen={strategySettings?.ir_frozen ?? false}
                      onChanged={refresh}
                      onClose={handleOpenClose}
                    />
                  </MonthExpirationGroup>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {closingOp && (
        <CloseOperationDialog
          operation={closingOp}
          open={!!closingOp}
          onOpenChange={(open) => {
            if (!open) {
              setClosingOp(null);
              setClosingOpAveragePrice(null);
            }
          }}
          onConfirm={handleClose}
          onRoll={handleRoll}
          averagePrice={closingOpAveragePrice}
          irFrozen={strategySettings?.ir_frozen ?? false}
        />
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <Layers className="h-8 w-8 text-faint-foreground" />
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}
