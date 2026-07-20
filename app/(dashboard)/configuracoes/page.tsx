'use client';

import { useState, useEffect } from 'react';
import { Settings, Sliders, Database, CheckCircle2, XCircle, Users, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getActiveScoreWeights,
  updateScoreWeights,
  getStrategySettings,
  updateStrategySettings,
  listHolders,
  createHolder,
  updateHolder,
} from '@/lib/supabase/queries';
import type { ScoreWeights, StrategySettings, Holder } from '@/lib/types/database';

type WeightKey = 'weight_delta' | 'weight_premium' | 'weight_strike_distance' | 'weight_liquidity' | 'weight_spread' | 'weight_history';

const WEIGHT_LABELS: { key: WeightKey; label: string }[] = [
  { key: 'weight_delta', label: 'Delta' },
  { key: 'weight_premium', label: 'Prêmio' },
  { key: 'weight_strike_distance', label: 'Distância do strike' },
  { key: 'weight_liquidity', label: 'Liquidez' },
  { key: 'weight_spread', label: 'Spread' },
  { key: 'weight_history', label: 'Histórico' },
];

import { parseBRNumber } from '@/lib/utils';

export default function ConfiguracoesPage() {
  const [weights, setWeights] = useState<ScoreWeights | null>(null);
  const [settings, setSettings] = useState<StrategySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Campos de texto locais (evita o bug de "0," virar "0" ao digitar em campo number-controlled)
  const [settingsText, setSettingsText] = useState<Record<string, string>>({});
  const [weightsText, setWeightsText] = useState<Record<string, string>>({});

  // Titulares
  const [holders, setHolders] = useState<Holder[]>([]);
  const [newHolderName, setNewHolderName] = useState('');
  const [newHolderCommission, setNewHolderCommission] = useState('');
  const [editingHolderId, setEditingHolderId] = useState<string | null>(null);
  const [editCommission, setEditCommission] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [w, s, h] = await Promise.all([getActiveScoreWeights(), getStrategySettings(), listHolders()]);
        setWeights(w);
        setSettings(s);
        setHolders(h);
        setSettingsText({
          max_delta: String(s.max_delta ?? '').replace('.', ','),
          min_delta: String(s.min_delta ?? '').replace('.', ','),
          available_cash: s.available_cash === null ? '' : String(s.available_cash).replace('.', ','),
          emergency_reserve: String(s.emergency_reserve ?? 0).replace('.', ','),
          initial_equity: s.initial_equity === null ? '' : String(s.initial_equity).replace('.', ','),
          ir_loss_to_offset: String(s.ir_loss_to_offset ?? 0).replace('.', ','),
          max_concentration_pct: s.max_concentration_pct === null ? '' : String(s.max_concentration_pct).replace('.', ','),
          min_days_to_expiration: s.min_days_to_expiration === null ? '' : String(s.min_days_to_expiration),
          max_days_to_expiration: s.max_days_to_expiration === null ? '' : String(s.max_days_to_expiration),
        });
        setWeightsText(
          Object.fromEntries(WEIGHT_LABELS.map((wl) => [wl.key, String(w[wl.key]).replace('.', ',')]))
        );
        setConnectionOk(true);
      } catch (err) {
        setConnectionOk(false);
        setLoadError(err instanceof Error ? err.message : 'Falha ao conectar ao Supabase.');
      }
    })();
  }, []);

  const totalWeight = WEIGHT_LABELS.reduce((sum, w) => sum + parseBRNumber(weightsText[w.key] ?? '0'), 0);

  async function handleSaveWeights() {
    if (!weights) return;
    setSaving(true);
    setSaved(false);
    try {
      const patch = Object.fromEntries(
        WEIGHT_LABELS.map((w) => [w.key, parseBRNumber(weightsText[w.key] ?? '0')])
      );
      const updated = await updateScoreWeights(weights.id, patch);
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
    setSaveError(null);
    try {
      const updated = await updateStrategySettings(settings.id, {
        max_delta: parseBRNumber(settingsText.max_delta ?? '0'),
        min_delta: parseBRNumber(settingsText.min_delta ?? '0'),
        available_cash: settingsText.available_cash?.trim() ? parseBRNumber(settingsText.available_cash) : null,
        emergency_reserve: parseBRNumber(settingsText.emergency_reserve ?? '0'),
        initial_equity: settingsText.initial_equity?.trim() ? parseBRNumber(settingsText.initial_equity) : null,
        ir_loss_to_offset: parseBRNumber(settingsText.ir_loss_to_offset ?? '0'),
        max_concentration_pct: settingsText.max_concentration_pct?.trim()
          ? parseBRNumber(settingsText.max_concentration_pct)
          : null,
        min_days_to_expiration: settingsText.min_days_to_expiration?.trim()
          ? Math.round(parseBRNumber(settingsText.min_days_to_expiration))
          : null,
        max_days_to_expiration: settingsText.max_days_to_expiration?.trim()
          ? Math.round(parseBRNumber(settingsText.max_days_to_expiration))
          : null,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddHolder() {
    if (!newHolderName.trim()) return;
    const holder = await createHolder({
      name: newHolderName.trim(),
      commissionPct: parseBRNumber(newHolderCommission || '0'),
    });
    setHolders((prev) => [...prev, holder]);
    setNewHolderName('');
    setNewHolderCommission('');
  }

  async function handleRemoveHolder(id: string) {
    const updated = await updateHolder(id, { active: false });
    setHolders((prev) => prev.filter((h) => h.id !== updated.id));
  }

  function startEditCommission(h: Holder) {
    setEditingHolderId(h.id);
    setEditCommission(String(h.commission_pct).replace('.', ','));
  }

  async function saveEditCommission(id: string) {
    const updated = await updateHolder(id, { commission_pct: parseBRNumber(editCommission) });
    setHolders((prev) => prev.map((h) => (h.id === id ? updated : h)));
    setEditingHolderId(null);
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
                value={settingsText.max_delta ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, max_delta: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Delta mínimo</Label>
              <Input
                className="font-tabular"
                value={settingsText.min_delta ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, min_delta: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Caixa disponível (R$)</Label>
              <Input
                className="font-tabular"
                value={settingsText.available_cash ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, available_cash: e.target.value }))}
              />
              <p className="text-[11px] text-faint-foreground">
                Usado nas Calculadoras e para verificar cobertura ao abrir uma nova PUT. Não alimenta mais o
                Dashboard — veja &quot;Patrimônio Inicial&quot; abaixo.
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                Patrimônio Inicial (R$)
                <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[9px] font-bold text-accent">DEFINE UMA VEZ</span>
              </Label>
              <Input
                className="font-tabular"
                value={settingsText.initial_equity ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, initial_equity: e.target.value }))}
              />
              <p className="text-[11px] text-faint-foreground">
                O caixa que você tinha antes da primeira operação registrada no sistema. A partir daqui o
                Dashboard calcula Patrimônio, Caixa Livre e Capital Comprometido sozinho, somando o lucro
                líquido de cada operação fechada e descontando os saques que você marcar — não precisa mais
                atualizar esse número toda semana.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Reserva de emergência (R$)</Label>
              <Input
                className="font-tabular"
                value={settingsText.emergency_reserve ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, emergency_reserve: e.target.value }))}
              />
              <p className="text-[11px] text-faint-foreground">
                Dinheiro no cofrinho do banco — soma ao Patrimônio, mas você não opera com ele.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Prejuízo a compensar (IR) (R$)</Label>
              <Input
                className="font-tabular"
                value={settingsText.ir_loss_to_offset ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, ir_loss_to_offset: e.target.value }))}
              />
              <p className="text-[11px] text-faint-foreground">
                Saldo de prejuízo ainda não compensado, olhando seu app de IR — atualize manualmente. Não soma
                ao Patrimônio; é só um indicador de referência no Dashboard.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Concentração máxima por operação (%)</Label>
              <Input
                className="font-tabular"
                value={settingsText.max_concentration_pct ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, max_concentration_pct: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Dias mín. até o vencimento</Label>
              <Input
                className="font-tabular"
                value={settingsText.min_days_to_expiration ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, min_days_to_expiration: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Dias máx. até o vencimento</Label>
              <Input
                className="font-tabular"
                value={settingsText.max_days_to_expiration ?? ''}
                onChange={(e) => setSettingsText((t) => ({ ...t, max_days_to_expiration: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
                {saved ? 'Salvo ✓' : saving ? 'Salvando…' : 'Salvar estratégia'}
              </Button>
              {saveError && <span className="text-xs text-danger">Erro ao salvar: {saveError}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-accent" />
            Titulares
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            {holders.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{h.name}</span>
                  {h.is_self && <Badge variant="success">você</Badge>}
                </div>
                <div className="flex items-center gap-2.5">
                  {!h.is_self &&
                    (editingHolderId === h.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editCommission}
                          onChange={(e) => setEditCommission(e.target.value)}
                          autoFocus
                          className="w-14 rounded-md border border-accent bg-surface px-1.5 py-1 font-tabular text-xs text-foreground outline-none"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <button onClick={() => saveEditCommission(h.id)} className="text-accent">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingHolderId(null)} className="text-muted-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditCommission(h)}
                        className="flex items-center gap-1 font-tabular text-xs text-muted-foreground hover:text-foreground"
                      >
                        comissão {String(h.commission_pct).replace('.', ',')}%
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    ))}
                  {!h.is_self && (
                    <button onClick={() => handleRemoveHolder(h.id)} className="text-faint-foreground hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-[2] space-y-1">
              <Label>Novo titular</Label>
              <Input value={newHolderName} onChange={(e) => setNewHolderName(e.target.value)} placeholder="Nome" />
            </div>
            <div className="flex-1 space-y-1">
              <Label>Comissão (%)</Label>
              <Input
                className="font-tabular"
                value={newHolderCommission}
                onChange={(e) => setNewHolderCommission(e.target.value)}
                placeholder="15"
              />
            </div>
            <Button size="sm" onClick={handleAddHolder} disabled={!newHolderName.trim()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    value={weightsText[w.key] ?? ''}
                    onChange={(e) => setWeightsText((t) => ({ ...t, [w.key]: e.target.value }))}
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
