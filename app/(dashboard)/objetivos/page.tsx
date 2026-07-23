'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Pencil, Target as TargetIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBRL, parseBRNumber, cn } from '@/lib/utils';
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getStrategySettings,
  listOperations,
  listWithdrawals,
  listCommissionEntries,
} from '@/lib/supabase/queries';
import { computeGoalProgress, GOAL_TYPE_LABELS } from '@/lib/goals/progress';
import { GoalProjectionChart } from '@/components/goals/goal-projection-chart';
import { computeKpis, computeEquitySeries } from '@/lib/hooks/use-dashboard-data';
import type { Goal, Operation, StrategySettings, Withdrawal, CommissionEntry } from '@/lib/types/database';

interface GoalFormState {
  name: string;
  targetType: Goal['target_type'];
  targetValue: string;
  deadline: string;
  currentValueText: string;
}

const EMPTY_FORM: GoalFormState = { name: '', targetType: 'patrimonio', targetValue: '', deadline: '', currentValueText: '' };

/** Divide dias restantes em anos + meses + dias, para exibição legível. */
function splitDuration(totalDays: number) {
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays - years * 365 - months * 30;
  return { years, months, days };
}

export default function ObjetivosPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [commissionEntries, setCommissionEntries] = useState<CommissionEntry[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [g, ops, wds, comms, settings] = await Promise.all([
        listGoals(),
        listOperations(),
        listWithdrawals(),
        listCommissionEntries(),
        getStrategySettings(),
      ]);
      setGoals(g);
      setOperations(ops);
      setWithdrawals(wds);
      setCommissionEntries(comms);
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
        const [g, ops, wds, comms, settings] = await Promise.all([
          listGoals(),
          listOperations(),
          listWithdrawals(),
          listCommissionEntries(),
          getStrategySettings(),
        ]);
        if (!cancelled) {
          setGoals(g);
          setOperations(ops);
          setWithdrawals(wds);
          setCommissionEntries(comms);
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

  const kpis = computeKpis(operations, strategySettings, withdrawals, commissionEntries);
  const equitySeries = computeEquitySeries(kpis.initialEquity, operations, withdrawals, commissionEntries);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(goal: Goal) {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      targetType: goal.target_type,
      targetValue: String(goal.target_value).replace('.', ','),
      deadline: goal.deadline ?? '',
      currentValueText: goal.current_value !== null ? String(goal.current_value).replace('.', ',') : '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.targetValue.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateGoal(editingId, {
          name: form.name.trim(),
          target_value: parseBRNumber(form.targetValue),
          deadline: form.deadline || null,
          current_value: form.targetType === 'personalizado' && form.currentValueText.trim() ? parseBRNumber(form.currentValueText) : null,
        });
      } else {
        await createGoal({
          name: form.name.trim(),
          targetType: form.targetType,
          targetValue: parseBRNumber(form.targetValue),
          deadline: form.deadline || null,
          currentValue: form.targetType === 'personalizado' && form.currentValueText.trim() ? parseBRNumber(form.currentValueText) : null,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
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
        <Button size="sm" onClick={openCreateForm}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Novo objetivo
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{editingId ? 'Editar objetivo' : 'Novo objetivo'}</span>
            <button onClick={() => setShowForm(false)} className="text-faint-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex: Patrimônio de R$1 milhão" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                value={form.targetType}
                onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value as Goal['target_type'] }))}
                disabled={!!editingId}
                className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm text-foreground disabled:opacity-60"
              >
                <option value="patrimonio">Patrimônio total</option>
                <option value="renda_mensal">Renda mensal</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor alvo (R$)</label>
              <Input
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                placeholder="0,00"
                className="font-tabular"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data limite (opcional)</label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
            {form.targetType === 'personalizado' && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Progresso atual (R$) — você atualiza manualmente</label>
                <Input
                  value={form.currentValueText}
                  onChange={(e) => setForm((f) => ({ ...f, currentValueText: e.target.value }))}
                  placeholder="0,00"
                  className="font-tabular"
                />
              </div>
            )}
          </div>
          <Button size="sm" className="mt-3" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar objetivo'}
          </Button>
        </div>
      )}

      {!loading && goals.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum objetivo criado ainda. Que tal começar com uma meta de patrimônio?
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {goals.map((goal) => {
          const progress = computeGoalProgress(goal, kpis.currentEquity, operations);
          const capped = Math.min(progress.progressPct, 100);
          const isDone = progress.progressPct >= 100;
          const duration = progress.daysRemaining !== null && progress.daysRemaining >= 0 ? splitDuration(progress.daysRemaining) : null;

          return (
            <div
              key={goal.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_0_0_1px_rgba(62,207,142,0.05)]"
            >
              <div className="bg-gradient-to-br from-accent-muted via-accent-muted/60 to-surface px-5 pb-5 pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15">
                      <TargetIcon className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-accent">{GOAL_TYPE_LABELS[goal.target_type]}</div>
                      <div className="text-sm font-semibold text-foreground">{goal.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditForm(goal)} className="text-faint-foreground hover:text-foreground" title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(goal.id)} className="text-faint-foreground hover:text-danger" title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-tabular text-[28px] font-semibold leading-none text-foreground">{formatBRL(progress.currentValue)}</span>
                  <span className="text-xs text-muted-foreground">de {formatBRL(goal.target_value)}</span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/20">
                  <div
                    className={cn('h-full rounded-full transition-all', isDone ? 'bg-accent' : 'bg-accent/80')}
                    style={{ width: `${Math.max(capped, 2)}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={cn('font-tabular font-semibold', isDone ? 'text-accent' : 'text-foreground')}>
                    {progress.progressPct.toFixed(1)}%
                  </span>
                  {duration && (
                    <span className="text-faint-foreground">
                      {duration.years > 0 && `${duration.years}a `}
                      {(duration.years > 0 || duration.months > 0) && `${duration.months}m `}
                      {duration.days}d restantes
                    </span>
                  )}
                  {progress.daysRemaining !== null && progress.daysRemaining < 0 && <span className="text-danger">Prazo vencido</span>}
                </div>
              </div>

              <div className="px-5 pb-5 pt-4">
                {goal.target_type === 'personalizado' && (
                  <div className="mb-3 flex items-center gap-2">
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
                  <>
                    <GoalProjectionChart progress={progress} equitySeries={equitySeries} />
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
