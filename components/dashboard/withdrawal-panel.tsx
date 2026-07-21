'use client';

import { useState } from 'react';
import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBRL, formatDate, parseBRNumber } from '@/lib/utils';
import { createWithdrawal, deleteWithdrawal, getSelfHolder } from '@/lib/supabase/queries';
import type { Withdrawal } from '@/lib/types/database';

interface WithdrawalPanelProps {
  entries: Withdrawal[]; // todos os saques — vinculados a uma operação ou não
  onChanged: () => void;
}

/**
 * Registro manual de saques INDEPENDENTES de uma operação específica
 * (para quando o valor sacado não corresponde exatamente ao prêmio de
 * uma operação — ex: sacou parte do caixa acumulado). Complementa o
 * botão "Sacar" que já existe em cada linha das tabelas de Operações
 * (esses continuam vinculados via operation_id). O total e o gráfico
 * somam TODOS os saques juntos, vinculados ou não.
 */
export function WithdrawalPanel({ entries, onChanged }: WithdrawalPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [amountRaw, setAmountRaw] = useState('');
  const [withdrawnAt, setWithdrawnAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  async function handleAdd() {
    const amount = parseBRNumber(amountRaw);
    if (amount <= 0) return;
    setSaving(true);
    try {
      const holder = await getSelfHolder();
      await createWithdrawal({ holderId: holder.id, amount, withdrawnAt, notes: notes.trim() || null });
      setAmountRaw('');
      setNotes('');
      setShowForm(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteWithdrawal(id);
    onChanged();
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-start gap-2">
        <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">
              Total sacado: <strong className="text-warning">{formatBRL(total)}</strong>
            </span>
            {!showForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
                <Plus className="mr-1 h-3 w-3" />
                Lançar saque
              </Button>
            )}
          </div>

          {entries.length > 0 && (
            <div className="flex flex-col gap-1">
              {entries
                .slice()
                .sort((a, b) => new Date(b.withdrawn_at).getTime() - new Date(a.withdrawn_at).getTime())
                .map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded border border-border bg-surface-elevated px-2 py-1 text-xs">
                    <span className="text-foreground">
                      {formatBRL(e.amount)} em {formatDate(e.withdrawn_at)}
                      {e.operation_id && <span className="text-faint-foreground"> — vinculado a operação</span>}
                      {e.notes && <span className="text-faint-foreground"> — {e.notes}</span>}
                    </span>
                    <button onClick={() => handleDelete(e.id)} className="text-faint-foreground hover:text-danger">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {showForm && (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="w-28 space-y-1">
                <label className="text-[10px] text-faint-foreground">Valor (R$)</label>
                <Input value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0,00" className="h-8 text-xs" />
              </div>
              <div className="w-36 space-y-1">
                <label className="text-[10px] text-faint-foreground">Data</label>
                <Input type="date" value={withdrawnAt} onChange={(e) => setWithdrawnAt(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="min-w-[140px] flex-1 space-y-1">
                <label className="text-[10px] text-faint-foreground">Observação (opcional)</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex: saque para reserva" className="h-8 text-xs" />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? 'Salvando…' : 'Confirmar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
