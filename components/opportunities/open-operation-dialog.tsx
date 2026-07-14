'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { calculateMaxContracts, calculateRequiredCapital, calculateExpectedPremium } from '@/lib/calculations/finance';
import { formatBRL } from '@/lib/utils';
import { listHolders } from '@/lib/supabase/queries';
import type { Opportunity, Holder } from '@/lib/types/database';
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
  const [holders, setHolders] = useState<Holder[]>([]);
  const [holderId, setHolderId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    listHolders()
      .then((list) => {
        setHolders(list);
        const self = list.find((h) => h.is_self);
        setHolderId((self ?? list[0])?.id ?? '');
      })
      .catch(() => setHolders([]));
  }, [open]);

  const qty = Number(quantity) || 0;
  const strike = entry?.strike ?? 0;
  const premium = entry?.premium ?? 0;

  const maxContracts = availableCash ? calculateMaxContracts({ availableCash, strike }) : null;
  const requiredCapital = calculateRequiredCapital({ strike, quantity: qty });
  const expectedPremium = calculateExpectedPremium({ premium, quantity: qty });

  async function handleConfirm() {
    if (!entry || !holderId) return;
    setSaving(true);
    try {
      await onConfirm({
        assetId: opportunity.asset_id,
        holderId,
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
          {holders.length > 1 && (
            <div className="space-y-1">
              <Label>Titular</Label>
              <Select value={holderId} onValueChange={setHolderId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {holders.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                      {!h.is_self ? ` (comissão ${h.commission_pct}%)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="qty">Quantidade de ações</Label>
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
            <Button disabled={saving || qty <= 0 || !holderId} onClick={handleConfirm}>
              {saving ? 'Salvando…' : 'Confirmar abertura'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
