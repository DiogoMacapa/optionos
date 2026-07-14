'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBRL, parseBRNumber } from '@/lib/utils';
import { listStockPositions, upsertStockPosition, closeStockPosition, findOrCreateAsset, listHolders } from '@/lib/supabase/queries';
import type { StockPosition, Holder } from '@/lib/types/database';

export function MyStocksTab() {
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [ticker, setTicker] = useState('');
  const [holderId, setHolderId] = useState('');
  const [qty, setQty] = useState('');
  const [avg, setAvg] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pos, hol] = await Promise.all([listStockPositions(), listHolders()]);
      setPositions(pos);
      setHolders(hol);
      setHolderId((prev) => prev || (hol.find((h) => h.is_self) ?? hol[0])?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar posições.');
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
        const [pos, hol] = await Promise.all([listStockPositions(), listHolders()]);
        if (cancelled) return;
        setPositions(pos);
        setHolders(hol);
        setHolderId((prev) => prev || (hol.find((h) => h.is_self) ?? hol[0])?.id || '');
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

  async function handleAdd() {
    if (!ticker.trim() || !qty || !avg || !holderId) return;
    setSaving(true);
    try {
      const asset = await findOrCreateAsset(ticker);
      await upsertStockPosition({
        assetId: asset.id,
        holderId,
        quantity: Math.round(parseBRNumber(qty)),
        averagePrice: parseBRNumber(avg),
      });
      setTicker('');
      setQty('');
      setAvg('');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    await closeStockPosition(id);
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }

  const holderName = (id: string) => holders.find((h) => h.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Usadas para calcular o resultado quando uma Covered Call é exercida (Strike − PM).
      </p>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {!loading && positions.length === 0 && !error && (
        <p className="text-sm text-faint-foreground">Nenhuma posição cadastrada ainda.</p>
      )}

      <div className="flex flex-col gap-2">
        {positions.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-tabular text-sm font-bold text-foreground">{p.asset?.ticker ?? '—'}</span>
              <Badge>{holderName(p.holder_id)}</Badge>
            </div>
            <div className="flex items-center gap-4 font-tabular text-xs">
              <span className="text-muted-foreground">
                Qtd <span className="text-foreground">{p.quantity.toLocaleString('pt-BR')}</span>
              </span>
              <span className="text-muted-foreground">
                PM <span className="text-accent">{formatBRL(p.average_price)}</span>
              </span>
              <button onClick={() => handleRemove(p.id)} className="text-faint-foreground hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Nova posição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label>Ticker</Label>
              <Input className="font-tabular" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="BPAC11" />
            </div>
            <div className="space-y-1">
              <Label>Titular</Label>
              <select
                value={holderId}
                onChange={(e) => setHolderId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-border bg-surface-elevated px-3 py-1 text-sm text-foreground outline-none"
              >
                {holders.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input className="font-tabular" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="9100" />
            </div>
            <div className="space-y-1">
              <Label>Preço médio (R$)</Label>
              <Input className="font-tabular" value={avg} onChange={(e) => setAvg(e.target.value)} placeholder="57,84" />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving || !ticker.trim() || !qty || !avg}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Adicionar posição'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
