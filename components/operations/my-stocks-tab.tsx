'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatBRL, formatDate, cn } from '@/lib/utils';
import { listStockPositions, closeStockPosition, listHolders, listStockSaleHistory } from '@/lib/supabase/queries';
import type { StockPosition, Holder, StockSaleHistory } from '@/lib/types/database';

export function MyStocksTab() {
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [saleHistory, setSaleHistory] = useState<StockSaleHistory[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [pos, hol, history] = await Promise.all([listStockPositions(), listHolders(), listStockSaleHistory()]);
        if (cancelled) return;
        setPositions(pos);
        setHolders(hol);
        setSaleHistory(history);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar posições.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(id: string) {
    await closeStockPosition(id);
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }

  const holderName = (id: string) => holders.find((h) => h.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Usadas para calcular o resultado quando uma Covered Call é exercida (Strike − PM). Preenchidas
        automaticamente ao ser exercido numa PUT ou CALL — nada a cadastrar manualmente aqui.
      </p>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {!loading && positions.length === 0 && !error && (
        <p className="text-sm text-faint-foreground">Nenhuma posição ainda.</p>
      )}

      <div className="flex flex-col gap-3">
        {positions.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-primary-accent-border bg-glass backdrop-blur-xl px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-accent/15">
                  <span className="font-tabular text-[10px] font-bold text-primary-accent">{(p.asset?.ticker ?? '—').slice(0, 4)}</span>
                </div>
                <div>
                  <div className="font-tabular text-base font-bold text-foreground">{p.asset?.ticker ?? '—'}</div>
                  <Badge>{holderName(p.holder_id)}</Badge>
                </div>
              </div>
              <button onClick={() => handleRemove(p.id)} className="text-faint-foreground hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quantidade</div>
                <div className="mt-0.5 font-tabular text-lg font-semibold text-foreground">{p.quantity.toLocaleString('pt-BR')}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground" title="Custo ajustado (Strike − Prêmio) — usado no cálculo de uma futura Covered Call">
                  Preço Médio
                </div>
                <div className="mt-0.5 font-tabular text-lg font-semibold text-primary-accent">{formatBRL(p.average_price)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground" title="Valor bruto que saiu do caixa (Strike × Qtd, sem descontar prêmio)">
                  Total Desembolsado
                </div>
                <div className="mt-0.5 font-tabular text-lg font-semibold text-foreground">
                  {formatBRL(p.total_invested ?? p.quantity * p.average_price)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {saleHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Histórico de Vendas de Ações</h2>
          <p className="text-xs text-muted-foreground">
            Registro permanente de baixas por exercício de Covered Call — continua aqui mesmo depois da posição zerar.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {saleHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-glass-border bg-glass backdrop-blur-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-tabular text-sm font-bold text-foreground">{h.asset?.ticker ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">
                    {h.quantity.toLocaleString('pt-BR')} ações · PM {formatBRL(h.average_price)} → Strike {formatBRL(h.strike)}
                  </span>
                  <span className="text-[11px] text-faint-foreground">{formatDate(h.sold_at)}</span>
                </div>
                <span className={cn('font-tabular text-sm font-semibold', h.gross_result >= 0 ? 'text-accent' : 'text-danger')}>
                  {h.gross_result >= 0 ? '+' : ''}
                  {formatBRL(h.gross_result)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
