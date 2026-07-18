'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBRL, formatDate, parseBRNumber } from '@/lib/utils';
import { listIrCreditUsage, createIrCreditUsage, deleteIrCreditUsage } from '@/lib/supabase/queries';
import type { IrCreditSummary, IrCreditUsage } from '@/lib/types/database';

interface IrCreditPanelProps {
  holderId: string | null; // null = todos os titulares (não permite lançar uso, só visualizar total)
  summary: IrCreditSummary | null;
}

export function IrCreditPanel({ holderId, summary }: IrCreditPanelProps) {
  const [usage, setUsage] = useState<IrCreditUsage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amountRaw, setAmountRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!holderId) return [];
    try {
      return await listIrCreditUsage(holderId);
    } catch {
      return [];
    }
  }, [holderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await refresh();
      if (!cancelled) setUsage(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (!summary || summary.ir_credit_generated_total <= 0) return null;

  const balance = summary.ir_credit_generated_total - summary.ir_credit_used_total;

  async function handleAddUsage() {
    if (!holderId) return;
    const amount = parseBRNumber(amountRaw);
    if (amount <= 0) return;
    setSaving(true);
    try {
      await createIrCreditUsage({ holderId, amount, notes: notes.trim() || null });
      setAmountRaw('');
      setNotes('');
      setShowForm(false);
      setUsage(await refresh());
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUsage(id: string) {
    await deleteIrCreditUsage(id);
    setUsage(await refresh());
  }

  return (
    <div className="rounded-lg border border-info/25 bg-info/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <div className="flex-1 space-y-2">
          <div className="text-sm text-info">
            Crédito de IR: <strong>{formatBRL(summary.ir_credit_generated_total)}</strong> gerado por operações com
            prejuízo, <strong>{formatBRL(summary.ir_credit_used_total)}</strong> já usado. Saldo disponível:{' '}
            <strong>{formatBRL(balance)}</strong>. Esse crédito abate o lucro bruto de operações futuras antes de
            calcular os 15% de IR — o abatimento não é automático, marque abaixo quando usar.
          </div>

          {holderId && (
            <>
              {usage.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  {usage.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded border border-info/20 bg-surface/40 px-2 py-1 text-xs">
                      <span className="text-foreground">
                        {formatBRL(u.amount)} usado em {formatDate(u.used_at)}
                        {u.notes && <span className="text-faint-foreground"> — {u.notes}</span>}
                      </span>
                      <button onClick={() => handleDeleteUsage(u.id)} className="text-faint-foreground hover:text-danger">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showForm ? (
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <div className="w-28 space-y-1">
                    <label className="text-[10px] text-faint-foreground">Valor usado (R$)</label>
                    <Input value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0,00" className="h-8 text-xs" />
                  </div>
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <label className="text-[10px] text-faint-foreground">Observação (opcional)</label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex: IR de julho" className="h-8 text-xs" />
                  </div>
                  <Button size="sm" onClick={handleAddUsage} disabled={saving}>
                    {saving ? 'Salvando…' : 'Confirmar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1 h-3 w-3" />
                  Marcar crédito usado
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
