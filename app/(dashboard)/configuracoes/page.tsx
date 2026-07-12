'use client';

import { useState, useEffect } from 'react';
import { Settings, Sliders, Database, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getActiveScoreWeights, updateScoreWeights, getStrategySettings, updateStrategySettings } from '@/lib/supabase/queries';
import type { ScoreWeights, StrategySettings } from '@/lib/types/database';

type WeightKey = 'weight_delta' | 'weight_premium' | 'weight_strike_distance' | 'weight_liquidity' | 'weight_spread' | 'weight_history';

const WEIGHT_LABELS: { key: WeightKey; label: string }[] = [
  { key: 'weight_delta', label: 'Delta' },
  { key: 'weight_premium', label: 'Prêmio' },
  { key: 'weight_strike_distance', label: 'Distância do strike' },
  { key: 'weight_liquidity', label: 'Liquidez' },
  { key: 'weight_spread', label: 'Spread' },
  { key: 'weight_history', label: 'Histórico' },
];

export default function ConfiguracoesPage() {
  const [weights, setWeights] = useState<ScoreWeights | null>(null);
  const [settings, setSettings] = useState<StrategySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [w, s] = await Promise.all([getActiveScoreWeights(), getStrategySettings()]);
        setWeights(w);
        setSettings(s);
        setConnectionOk(true);
      } catch (err) {
        setConnectionOk(false);
        setLoadError(err instanceof Error ? err.message : 'Falha ao conectar ao Supabase.');
      }
    })();
  }, []);

  const totalWeight = weights
    ? WEIGHT_LABELS.reduce((sum, w) => sum + Number(weights[w.key]), 0)
    : 0;

  async function handleSaveWeights() {
    if (!weights) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateScoreWeights(weights.id, weights);
      setWeights(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateStrategySettings(settings.id, settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Estratégia, pesos do Score e conexão com o banco.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Database className="h-4 w-4 text-accent" />
            Conexão Supabase
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectionOk === null && <p className="text-sm text-muted-foreground">Verificando…</p>}
          {connectionOk === true && (
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 className="h-4 w-4" />
              Conectado normalmente.
            </div>
          )}
          {connectionOk === false && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-danger">
                <XCircle className="h-4 w-4" />
                Não foi possível conectar.
              </div>
              <p className="text-xs text-muted-foreground">{loadError}</p>
              <p className="text-xs text-faint-foreground">
                Verifique se as variáveis <code className="font-tabular">NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
                <code className="font-tabular">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> estão configuradas corretamente na Vercel.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Settings className="h-4 w-4 text-accent" />
              Estratégia
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Delta máximo</Label>
              <Input
                className="font-tabular"
                value={settings.max_delta}
                onChange={(e) => setSettings({ ...settings, max_delta: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Delta mínimo</Label>
              <Input
                className="font-tabular"
                value={settings.min_delta}
                onChange={(e) => setSettings({ ...settings, min_delta: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Caixa disponível (R$)</Label>
              <Input
                className="font-tabular"
                value={settings.available_cash ?? ''}
                onChange={(e) => setSettings({ ...settings, available_cash: Number(e.target.value) || null })}
              />
            </div>
            <div className="space-y-1">
              <Label>Concentração máxima por operação (%)</Label>
              <Input
                className="font-tabular"
                value={settings.max_concentration_pct ?? ''}
                onChange={(e) => setSettings({ ...settings, max_concentration_pct: Number(e.target.value) || null })}
              />
            </div>
            <div className="space-y-1">
              <Label>Dias mín. até o vencimento</Label>
              <Input
                className="font-tabular"
                value={settings.min_days_to_expiration ?? ''}
                onChange={(e) => setSettings({ ...settings, min_days_to_expiration: Number(e.target.value) || null })}
              />
            </div>
            <div className="space-y-1">
              <Label>Dias máx. até o vencimento</Label>
              <Input
                className="font-tabular"
                value={settings.max_days_to_expiration ?? ''}
                onChange={(e) => setSettings({ ...settings, max_days_to_expiration: Number(e.target.value) || null })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
                {saved ? 'Salvo ✓' : saving ? 'Salvando…' : 'Salvar estratégia'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {weights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sliders className="h-4 w-4 text-accent" />
              Pesos do Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {WEIGHT_LABELS.map((w) => (
                <div key={w.key} className="space-y-1">
                  <Label>{w.label}</Label>
                  <Input
                    className="font-tabular"
                    value={weights[w.key]}
                    onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) || 0 })}
                  />
                </div>
              ))}
            </div>
            <p className={`text-xs ${Math.abs(totalWeight - 1) > 0.01 ? 'text-warning' : 'text-faint-foreground'}`}>
              Soma dos pesos: {totalWeight.toFixed(2)}{' '}
              {Math.abs(totalWeight - 1) > 0.01 && '— idealmente deve somar 1.00 (o sistema normaliza automaticamente, mas fica mais fácil de calibrar assim).'}
            </p>
            <Button size="sm" onClick={handleSaveWeights} disabled={saving}>
              {saved ? 'Salvo ✓' : saving ? 'Salvando…' : 'Salvar pesos'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
