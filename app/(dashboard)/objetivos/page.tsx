'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBRL, parseBRNumber, cn } from '@/lib/utils';
import { listGoals, createGoal, updateGoal, deleteGoal, getStrategySettings, listOperations } from '@/lib/supabase/queries';
import { computeGoalProgress, GOAL_TYPE_LABELS } from '@/lib/goals/progress';
import { GoalProjectionChart } from '@/components/goals/goal-projection-chart';
import { computeKpis } from '@/lib/hooks/use-dashboard-data';
import type { Goal, Operation, StrategySettings } from '@/lib/types/database';

export default function ObjetivosPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<Goal['target_type']>('patrimonio');
  const [targetValue, setTargetValue] = useState('');
  const [deadline, setDeadline] = useState('');
  const [currentValueText, setCurrentValueText] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [g, ops, settings] = await Promise.all([listGoals(), listOperations(), getStrategySettings()]);
      setGoals(g);
      setOperations(ops);
      setStrategySettings(settings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [g, ops, settings] = await Promise.all([listGoals(), listOperations(), getStrategySettings()]);
        if (!cancelled) {
          setGoals(g);
          setOperations(ops);
          setStrategySettings(settings);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = computeKpis(operations, strategySettings, [], []);

  async function handleCreate() {
    if (!name.trim() || !targetValue.trim()) return;
    setSaving(true);
    try {
      await createGoal({
        name: name.trim(),
        targetType,
        targetValue: parseBRNumber(targetValue),
        deadline: deadline || null,
        currentValue: targetType === 'personalizado' && currentValueText.trim() ? parseBRNumber(currentValueText) : null,
      });
      setName('');
      setTargetValue('');
      setDeadline('');
      setCurrentValueText('');
      setTargetType('patrimonio');
      setShowForm(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCurrentValue(goal: Goal, raw: string) {
    await updateGoal(goal.id, { current_value: raw.trim() === '' ? null : parseBRNumber(raw) });
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir este objetivo?')) return;
    await deleteGoal(id);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Objetivos</h1>
          <p className="text-sm text-muted-foreground">Metas financeiras com progresso automático.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Novo objetivo
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Novo objetivo</span>
            <button onClick={() => setShowForm(false)} className="text-faint-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Patrimônio de R$1 milhão" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as Goal['target_type'])}
                className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm text-foreground"
              >
                <option value="patrimonio">Patrimônio total</option>
                <option value="renda_mensal">Renda mensal</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor alvo (R$)</label>
              <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="0,00" className="font-tabular" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data limite (opcional)</label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            {targetType === 'personalizado' && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Progresso atual (R$) — você atualiza manualmente</label>
                <Input value={currentValueText} onChange={(e) => setCurrentValueText(e.target.value)} placeholder="0,00" className="font-tabular" />
              </div>
            )}
          </div>
          <Button size="sm" className="mt-3" onClick={handleCreate} disabled={saving}>
            {saving ? 'Salvando…' : 'Criar objetivo'}
          </Button>
        </div>
      )}

      {!loading && goals.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum objetivo criado ainda. Que tal começar com uma meta de patrimônio?
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {goals.map((goal) => {
          const progress = computeGoalProgress(goal, kpis.currentEquity, operations);
          const capped = Math.min(progress.progressPct, 100);
          const isDone = progress.progressPct >= 100;

          return (
            <div key={goal.id} className="rounded-xl border border-border bg-gradient-to-br from-accent-muted to-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-accent">{GOAL_TYPE_LABELS[goal.target_type]}</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{goal.name}</div>
                </div>
                <button onClick={() => handleDelete(goal.id)} className="text-faint-foreground hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-tabular text-2xl font-semibold text-foreground">{formatBRL(progress.currentValue)}</span>
                <span className="text-xs text-muted-foreground">de {formatBRL(goal.target_value)}</span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={cn('h-full rounded-full transition-all', isDone ? 'bg-accent' : 'bg-accent/70')}
                  style={{ width: `${Math.max(capped, 2)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={cn('font-tabular font-medium', isDone ? 'text-accent' : 'text-muted-foreground')}>
                  {progress.progressPct.toFixed(1)}%
                </span>
                {progress.daysRemaining !== null && (
                  <span className="text-faint-foreground">
                    {progress.daysRemaining >= 0 ? `${progress.daysRemaining} dias restantes` : 'Prazo vencido'}
                  </span>
                )}
              </div>

              {goal.target_type === 'personalizado' && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-[11px] text-faint-foreground">Atualizar progresso:</label>
                  <Input
                    key={`goal-${goal.id}-${goal.current_value}`}
                    defaultValue={goal.current_value !== null ? String(goal.current_value).replace('.', ',') : ''}
                    onBlur={(e) => handleUpdateCurrentValue(goal, e.target.value)}
                    placeholder="0,00"
                    className="h-7 w-24 text-xs font-tabular"
                  />
                </div>
              )}

              {goal.deadline && (
                <div className="mt-4 border-t border-border pt-3">
                  <GoalProjectionChart progress={progress} />
                  {progress.neededPerMonth !== null && (
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-[11px] text-muted-foreground">Preciso juntar por mês</span>
                      <span className={cn('font-tabular text-sm font-semibold', progress.neededPerMonth <= 0 ? 'text-accent' : 'text-foreground')}>
                        {progress.neededPerMonth <= 0 ? 'Meta já alcançada' : formatBRL(progress.neededPerMonth)}
                      </span>
                    </div>
                  )}
                  {progress.recentAvgProfitPerMonth !== null && progress.neededPerMonth !== null && progress.neededPerMonth > 0 && (
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-[11px] text-faint-foreground">Seu ritmo recente (últimos 3 meses)</span>
                      <span
                        className={cn(
                          'font-tabular text-xs',
                          progress.recentAvgProfitPerMonth >= progress.neededPerMonth ? 'text-accent' : 'text-warning'
                        )}
                      >
                        {formatBRL(progress.recentAvgProfitPerMonth)}/mês
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
