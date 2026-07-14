'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpirationGroup, groupByExpiration } from '@/components/operations/expiration-group';
import { CloseOperationDialog } from '@/components/operations/close-operation-dialog';
import { MyStocksTab } from '@/components/operations/my-stocks-tab';
import {
  listOperations,
  closeOperation,
  rollOperation,
  getStockPosition,
  type CloseOperationInput,
  type NewOperationInput,
} from '@/lib/supabase/queries';
import type { Operation, OperationStatus } from '@/lib/types/database';

const STATUS_TABS: { value: OperationStatus | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'aberta', label: 'Abertas' },
  { value: 'encerrada', label: 'Encerradas' },
  { value: 'rolada', label: 'Roladas' },
  { value: 'exercida', label: 'Exercidas' },
];

export default function OperacoesPage() {
  const [mainTab, setMainTab] = useState<'operacoes' | 'acoes'>('operacoes');
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<OperationStatus | 'todas'>('aberta');
  const [holderFilter, setHolderFilter] = useState<string | 'todos'>('todos');
  const [closingOp, setClosingOp] = useState<Operation | null>(null);
  const [closingOpAveragePrice, setClosingOpAveragePrice] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(true);

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

  const holders = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of operations) {
      if (o.holder) map.set(o.holder.id, o.holder.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [operations]);

  const filtered = useMemo(() => {
    let list = tab === 'todas' ? operations : operations.filter((o) => o.status === tab);
    if (holderFilter !== 'todos') list = list.filter((o) => o.holder_id === holderFilter);
    return [...list].sort((a, b) =>
      sortDesc
        ? new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
        : new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
    );
  }, [operations, tab, holderFilter, sortDesc]);

  const grouped = useMemo(() => groupByExpiration(filtered), [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: operations.length };
    for (const o of operations) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [operations]);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Operações</h1>
        <p className="text-sm text-muted-foreground">Agrupadas por vencimento, com posições em ações à parte.</p>
      </div>

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

      {mainTab === 'acoes' ? (
        <MyStocksTab />
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as OperationStatus | 'todas')}>
              <TabsList>
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                    {counts[t.value] ? (
                      <span className="ml-1.5 rounded-full bg-surface px-1.5 text-[10px] text-faint-foreground">
                        {counts[t.value]}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3">
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

              <button
                onClick={() => setSortDesc((s) => !s)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover"
              >
                {sortDesc ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                Data de abertura
              </button>
            </div>
          </div>

          {!loading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
              <Layers className="h-8 w-8 text-faint-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhuma operação {tab !== 'todas' ? `com status "${tab}"` : ''}</p>
                <p className="mt-1 text-xs text-muted-foreground">Abra uma operação a partir de uma oportunidade no ranking.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {grouped.map(([expiration, ops], i) => (
              <div key={expiration} className={i > 0 ? 'border-t border-border pt-1' : ''}>
                <ExpirationGroup expiration={expiration} operations={ops} onClose={handleOpenClose} defaultOpen={i < 2} />
              </div>
            ))}
          </div>
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
