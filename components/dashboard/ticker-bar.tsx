'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { formatNumber, formatPct } from '@/lib/utils';
import { listWatchlistTickers, addWatchlistTicker, removeWatchlistTicker } from '@/lib/supabase/queries';
import type { WatchlistTicker } from '@/lib/types/database';

interface QuoteState {
  price: number | null;
  changePercent: number | null;
  loading: boolean;
  error: boolean;
}

// 5 min — a brapi.dev (usada em /api/quote) tem 15.000 requisições grátis
// por mês, compartilhadas com o resto do sistema (checagem de exercício,
// calculadoras). Um intervalo curto demais aqui estoura a cota rápido.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Faixa de cotações no topo do Dashboard. Diferente da tabela `assets`
 * (que só ganha uma linha quando existe operação aberta), aqui o
 * usuário cadastra livremente qualquer ativo que queira acompanhar —
 * lista fica salva no Supabase, então é a mesma em qualquer aparelho.
 */
export function TickerBar() {
  const [tickers, setTickers] = useState<WatchlistTicker[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [input, setInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    listWatchlistTickers()
      .then((rows) => {
        if (mountedRef.current) setTickers(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) setLoadingList(false);
      });
  }, []);

  useEffect(() => {
    if (tickers.length === 0) return;
    refreshQuotes(tickers);
    const interval = setInterval(() => refreshQuotes(tickers), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.map((t) => t.ticker).join(',')]);

  async function refreshQuotes(list: WatchlistTicker[]) {
    setQuotes((prev) => {
      const next = { ...prev };
      for (const t of list) {
        const current = next[t.ticker];
        next[t.ticker] = {
          price: current?.price ?? null,
          changePercent: current?.changePercent ?? null,
          loading: true,
          error: false,
        };
      }
      return next;
    });

    await Promise.all(
      list.map(async (t) => {
        try {
          const res = await fetch(`/api/quote?ticker=${encodeURIComponent(t.ticker)}`);
          if (!res.ok) throw new Error('quote failed');
          const data = await res.json();
          if (!mountedRef.current) return;
          setQuotes((prev) => ({
            ...prev,
            [t.ticker]: { price: Number(data.price), changePercent: data.changePercent ?? null, loading: false, error: false },
          }));
        } catch {
          if (!mountedRef.current) return;
          setQuotes((prev) => ({
            ...prev,
            [t.ticker]: { price: prev[t.ticker]?.price ?? null, changePercent: prev[t.ticker]?.changePercent ?? null, loading: false, error: true },
          }));
        }
      })
    );
  }

  async function handleAdd() {
    const clean = input.trim().toUpperCase();
    if (!clean) {
      setAddError('Digite o código do ativo primeiro.');
      return;
    }
    if (tickers.some((t) => t.ticker === clean)) {
      setAddError('Esse ativo já está na lista.');
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      const created = await addWatchlistTicker(clean);
      setTickers((prev) => [...prev, created]);
      setInput('');
      refreshQuotes([created]);
    } catch {
      setAddError('Não foi possível adicionar agora. Tente de novo.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(t: WatchlistTicker) {
    setTickers((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await removeWatchlistTicker(t.id);
    } catch {
      // Não conseguiu apagar no banco — recarrega a lista real pra não ficar dessincronizado.
      listWatchlistTickers().then(setTickers).catch(() => {});
    }
  }

  if (loadingList) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-glass-border bg-glass px-3 py-2 backdrop-blur-xl">
      {tickers.map((t) => {
        const q = quotes[t.ticker];
        const positive = (q?.changePercent ?? 0) >= 0;
        return (
          <div
            key={t.id}
            className="group flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 font-tabular text-xs"
          >
            <span className="text-muted-foreground">{t.ticker}</span>
            {q?.error ? (
              <span className="text-faint-foreground">—</span>
            ) : q?.loading || !q ? (
              <span className="text-faint-foreground">...</span>
            ) : (
              <>
                <span className="text-foreground">{formatNumber(q.price)}</span>
                {q.changePercent !== null && (
                  <span className={positive ? 'text-accent' : 'text-danger'}>
                    {positive ? '+' : ''}
                    {formatPct(q.changePercent, 1)}
                  </span>
                )}
              </>
            )}
            <button
              onClick={() => handleRemove(t)}
              aria-label={`Remover ${t.ticker} da lista`}
              className="text-faint-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-1 items-center gap-1.5">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (addError) setAddError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Adicionar ativo, ex: WEGE3"
          maxLength={7}
          className="w-36 rounded-full border border-white/10 bg-transparent px-3 py-1 font-tabular text-xs uppercase text-foreground placeholder:text-faint-foreground placeholder:normal-case focus:outline-none focus:ring-1 focus:ring-primary-accent-border"
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1 rounded-full bg-primary-accent/15 px-2.5 py-1 text-xs font-medium text-primary-accent transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
        {tickers.length > 0 && (
          <button
            onClick={() => refreshQuotes(tickers)}
            aria-label="Atualizar cotações"
            title="Atualizar cotações"
            className="ml-auto text-faint-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {addError && <span className="w-full text-xs text-danger">{addError}</span>}
    </div>
  );
}
