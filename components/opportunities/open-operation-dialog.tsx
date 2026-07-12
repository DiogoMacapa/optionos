'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { calculateMaxContracts, calculateRequiredCapital, calculateExpectedPremium } from '@/lib/calculations/finance';
import { formatBRL } from '@/lib/utils';
import type { Opportunity } from '@/lib/types/database';
import type { NewOperationInput } from '@/lib/supabase/queries';

interface OpenOperationDialogProps {
  opportunity: Opportunity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCash: number | null;
  onConfirm: (input: NewOperationInput) => Promise<void>;
}

export function OpenOperationDialog({ opportunity, open, onOpenChange, availableCash, onConfirm }: OpenOperationDialogProps) {
  const entry = opportunity.option_chain_entry;
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const qty = Number(quantity) || 0;
  const strike = entry?.strike ?? 0;
  const premium = entry?.premium ?? 0;

  const maxContracts = availableCash ? calculateMaxContracts({ availableCash, strike }) : null;
  const requiredCapital = calculateRequiredCapital({ strike, quantity: qty });
  const expectedPremium = calculateExpectedPremium({ premium, quantity: qty });

  async function handleConfirm() {
    if (!entry) return;
    setSaving(true);
    try {
      await onConfirm({
        assetId: opportunity.asset_id,
        opportunityId: opportunity.id,
        optionType: entry.option_type,
        strike: entry.strike,
        expiration: entry.expiration,
        quantity: qty,
        premiumReceived: expectedPremium,
        deltaAtOpen: entry.delta,
        committedCapital: requiredCapital,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir operação — {opportunity.asset?.ticker}</DialogTitle>
          <DialogDescription>
            {entry?.option_type} strike {entry?.strike} · vence{' '}
            {entry ? new Date(entry.expiration).toLocaleDateString('pt-BR') : '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="qty">Quantidade de contratos</Label>
            <Input id="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-tabular" />
            {maxContracts !== null && (
              <p className="text-xs text-faint-foreground">Máximo com seu caixa configurado: {maxContracts}</p>
            )}
          </div>

          <div className="space-y-1.5 rounded-lg border border-border bg-surface-elevated p-3 font-tabular text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Capital comprometido</span>
              <span className={requiredCapital > (availableCash ?? Infinity) ? 'text-danger' : 'text-foreground'}>
                {formatBRL(requiredCapital)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Prêmio esperado</span>
              <span className="text-accent">{formatBRL(expectedPremium)}</span>
            </div>
          </div>

          {requiredCapital > (availableCash ?? Infinity) && (
            <p className="text-xs text-danger">
              Atenção: essa quantidade excede o caixa disponível configurado em Configurações.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || qty <= 0} onClick={handleConfirm}>
              {saving ? 'Salvando…' : 'Confirmar abertura'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
