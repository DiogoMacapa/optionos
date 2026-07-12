'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OperationRow } from '@/components/operations/operation-row';
import { CloseOperationDialog } from '@/components/operations/close-operation-dialog';
import { listOperations, closeOperation, type CloseOperationInput } from '@/lib/supabase/queries';
import { daysBetween } from '@/lib/calculations/finance';
import type { Operation, OperationStatus } from '@/lib/types/database';

const STATUS_TABS: { value: OperationStatus | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'aberta', label: 'Abertas' },
  { value: 'encerrada', label: 'Encerradas' },
  { value: 'rolada', label: 'Roladas' },
  { value: 'exercida', label: 'Exercidas' },
];

export default function OperacoesPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<OperationStatus | 'todas'>('aberta');
  const [closingOp, setClosingOp] = useState<Operation | null>(null);
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

  const filtered = useMemo(() => {
    const list = tab === 'todas' ? operations : operations.filter((o) => o.status === tab);
    return [...list].sort((a, b) =>
      sortDesc
        ? new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
        : new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
    );
  }, [operations, tab, sortDesc]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: operations.length };
    for (const o of operations) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [operations]);

  async function handleClose(input: CloseOperationInput) {
    await closeOperation(input);
    setClosingOp(null);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Operações</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento das operações abertas e encerradas.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
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

        <button
          onClick={() => setSortDesc((s) => !s)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover"
        >
          {sortDesc ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          Data de abertura
        </button>
      </div>

      {!loading && filtered.length === 0 && !error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <Layers className="h-8 w-8 text-faint-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma operação {tab !== 'todas' ? `com status "${tab}"` : ''}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Abra uma operação a partir de uma oportunidade no ranking.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((op) => (
          <OperationRow
            key={op.id}
            operation={op}
            daysRemaining={daysBetween(new Date(), op.expiration)}
            onClose={() => setClosingOp(op)}
          />
        ))}
      </div>

      {closingOp && (
        <CloseOperationDialog
          operation={closingOp}
          open={!!closingOp}
          onOpenChange={(open) => !open && setClosingOp(null)}
          onConfirm={handleClose}
        />
      )}
    </div>
  );
}
