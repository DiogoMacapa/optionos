'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { calculateNetProfit } from '@/lib/calculations/finance';
import { formatBRL } from '@/lib/utils';
import { GlossaryTerm } from '@/components/shared/glossary-term';
import type { Operation } from '@/lib/types/database';
import type { CloseOperationInput } from '@/lib/supabase/queries';

interface CloseOperationDialogProps {
  operation: Operation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CloseOperationInput) => Promise<void>;
}

type OutcomeType = 'expirou' | 'recomprou' | 'exercida';

export function CloseOperationDialog({ operation, open, onOpenChange, onConfirm }: CloseOperationDialogProps) {
  const [outcome, setOutcome] = useState<OutcomeType>('expirou');
  const [buybackCost, setBuybackCost] = useState('0');
  const [saving, setSaving] = useState(false);

  const totalPremium = operation.premium_received;
  const cost = outcome === 'expirou' ? 0 : Number(buybackCost.replace(',', '.')) || 0;

  const result = useMemo(
    () => calculateNetProfit({ premiumReceived: totalPremium, buybackCost: cost }),
    [totalPremium, cost]
  );

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm({
        id: operation.id,
        status: outcome === 'exercida' ? 'exercida' : 'encerrada',
        closePrice: cost,
        netProfit: result.netProfit,
        irAmount: result.ir,
        exercised: outcome === 'exercida',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar operação — {operation.asset?.ticker}</DialogTitle>
          <DialogDescription>
            {operation.option_type} strike {operation.strike} · vence {new Date(operation.expiration).toLocaleDateString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>O que aconteceu?</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as OutcomeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expirou">Expirou sem valor (prêmio total capturado)</SelectItem>
                <SelectItem value="recomprou">Recomprei antes do vencimento</SelectItem>
                <SelectItem value="exercida">Fui exercido</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-faint-foreground">
              <GlossaryTerm termKey="exercicio">O que é exercício?</GlossaryTerm> · <GlossaryTerm termKey="rolagem">O que é rolagem?</GlossaryTerm>
            </p>
          </div>

          {outcome === 'recomprou' && (
            <div className="space-y-1">
              <Label htmlFor="buyback">Custo de recompra (total)</Label>
              <Input
                id="buyback"
                value={buybackCost}
                onChange={(e) => setBuybackCost(e.target.value)}
                className="font-tabular"
                placeholder="0,00"
              />
            </div>
          )}

          <div className="space-y-1.5 rounded-lg border border-border bg-surface-elevated p-3 font-tabular text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Prêmio recebido</span>
              <span className="text-foreground">{formatBRL(totalPremium)}</span>
            </div>
            {cost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Custo de recompra</span>
                <span className="text-danger">-{formatBRL(cost)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>IR (15% sobre o lucro)</span>
              <span className="text-danger">-{formatBRL(result.ir)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
              <span className="text-foreground">Lucro líquido</span>
              <span className={result.netProfit >= 0 ? 'text-accent' : 'text-danger'}>{formatBRL(result.netProfit)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={handleConfirm}>
              {saving ? 'Salvando…' : 'Confirmar encerramento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
