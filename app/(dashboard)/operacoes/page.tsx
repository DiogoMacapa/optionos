'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Briefcase, Plus } from 'lucide-react';
import { ExpirationGroup, groupByExpiration } from '@/components/operations/expiration-group';
import { MonthExpirationGroup, groupByExpirationMonth } from '@/components/operations/month-expiration-group';
import { CloseOperationDialog } from '@/components/operations/close-operation-dialog';
import { MyStocksTab } from '@/components/operations/my-stocks-tab';
import {
  listOperations,
  closeOperation,
  rollOperation,
  getStockPosition,
  createOperation,
  getSelfHolder,
  findOrCreateAsset,
  type CloseOperationInput,
  type NewOperationInput,
} from '@/lib/supabase/queries';
import type { Operation } from '@/lib/types/database';

export default function OperacoesPage() {
  const [mainTab, setMainTab] = useState<'operacoes' | 'acoes'>('operacoes');
  const [subTab, setSubTab] = useState<'PUT' | 'CALL'>('PUT');
  const [operations, setOperations] = useState<Operation[]>([]);
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
      const data = await listOperations();
      setOperations(data);
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
        const data = await listOperations();
        if (!cancelled) setOperations(data);
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
  const callGrouped = useMemo(() => groupByExpiration(callOps), [callOps]);

  async function handleClose(input: CloseOperationInput) {
    await closeOperation(input);
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
   * Cria uma operação PUT em branco (valores mínimos) para o usuário
   * preencher diretamente na tabela — mesmo fluxo de edição inline já
   * usado nas linhas existentes, sem formulário separado.
   */
  async function handleAddOperation() {
    setAddingOperation(true);
    try {
      const [holder, asset] = await Promise.all([getSelfHolder(), findOrCreateAsset('NOVO')]);
      const today = new Date().toISOString().slice(0, 10);
      await createOperation({
        assetId: asset.id,
        holderId: holder.id,
        opportunityId: null,
        optionType: 'PUT',
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
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Operações</h1>
        <p className="text-sm text-muted-foreground">Agrupadas por mês de vencimento — fiel à sua planilha, com automações.</p>
      </div>

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

          {mainTab === 'operacoes' && subTab === 'PUT' && (
            <button
              onClick={handleAddOperation}
              disabled={addingOperation}
              className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-muted px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {addingOperation ? 'Adicionando…' : 'Adicionar operação'}
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
                    onChanged={refresh}
                    onClose={handleOpenClose}
                    defaultOpen={i === putGrouped.length - 1}
                  />
                ))}
              </div>
            </>
          )}

          {subTab === 'CALL' && (
            <>
              {!loading && callOps.length === 0 && !error && (
                <EmptyState label="Nenhuma operação de CALL ainda." />
              )}
              <div className="flex flex-col gap-1">
                {callGrouped.map(([expiration, ops], i) => (
                  <div key={expiration} className={i > 0 ? 'border-t border-border pt-1' : ''}>
                    <ExpirationGroup expiration={expiration} operations={ops} onClose={handleOpenClose} defaultOpen={i < 2} />
                  </div>
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
