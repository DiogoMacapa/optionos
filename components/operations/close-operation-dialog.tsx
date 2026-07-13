'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { calculateNetProfit, calculateStockSaleResult, calculateCommission } from '@/lib/calculations/finance';
import { formatBRL } from '@/lib/utils';
import { GlossaryTerm } from '@/components/shared/glossary-term';
import type { Operation } from '@/lib/types/database';
import type { CloseOperationInput } from '@/lib/supabase/queries';

interface CloseOperationDialogProps {
  operation: Operation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CloseOperationInput) => Promise<void>;
  /** Preço médio das ações (só relevante se for CALL e puder ser exercida). */
  averagePrice?: number | null;
}

type OutcomeType = 'expirou' | 'recomprou' | 'exercida';

export function CloseOperationDialog({
  operation,
  open,
  onOpenChange,
  onConfirm,
  averagePrice,
}: CloseOperationDialogProps) {
  const [outcome, setOutcome] = useState<OutcomeType>('expirou');
  const [buybackCost, setBuybackCost] = useState('0');
  const [saving, setSaving] = useState(false);

  const totalPremium = operation.premium_received;
  const cost = outcome === 'expirou' ? 0 : Number(buybackCost.replace(',', '.')) || 0;
  const exercised = outcome === 'exercida';
  const hasCommission = !!operation.holder && !operation.holder.is_self && operation.holder.commission_pct > 0;

  const stockSaleResult =
    exercised && operation.option_type === 'CALL' && averagePrice
      ? calculateStockSaleResult(operation.strike, averagePrice, operation.quantity)
      : 0;

  const result = useMemo(
    () =>
      calculateNetProfit({
        optionType: operation.option_type,
        premiumReceived: totalPremium,
        buybackCost: cost,
        exercised,
        strikeVsAveragePriceResult: stockSaleResult,
      }),
    [operation.option_type, totalPremium, cost, exercised, stockSaleResult]
  );

  const commission = useMemo(
    () =>
      hasCommission
        ? calculateCommission({ netProfit: result.netProfit, commissionPct: operation.holder!.commission_pct })
        : { commissionAmount: 0, holderNetAfterCommission: result.netProfit },
    [hasCommission, result.netProfit, operation.holder]
  );

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm({
        id: operation.id,
        status: exercised ? 'exercida' : 'encerrada',
        closePrice: cost,
        netProfit: result.netProfit,
        irAmount: result.ir,
        exercised,
        grossResult: result.grossResult,
        irBase: result.irBase,
        efficiencyPct: result.efficiencyPct,
        commissionAmount: commission.commissionAmount,
      });
    } finally {
      setSaving(false);
    }
  }

  const irLabel =
    operation.option_type === 'PUT'
      ? 'IR (15% sobre prêmio − recompra)'
      : exercised
        ? 'IR (15% sobre prêmio + resultado da venda)'
        : 'IR (15% sobre o prêmio bruto)';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar operação — {operation.asset?.ticker}</DialogTitle>
          <DialogDescription>
            {operation.option_type} strike {operation.strike} · vence {new Date(operation.expiration).toLocaleDateString('pt-BR')}
            {hasCommission ? ` · titular: ${operation.holder!.name}` : ''}
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

          {exercised && operation.option_type === 'CALL' && !averagePrice && (
            <p className="rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 text-xs text-warning">
              Nenhum preço médio (PM) cadastrado para este ativo — o resultado da venda das ações não será
              incluído no cálculo do IR. Cadastre o PM em Configurações para um cálculo completo.
            </p>
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
            {exercised && operation.option_type === 'CALL' && !!averagePrice && (
              <div className="flex justify-between text-muted-foreground">
                <span>Resultado da venda (Strike − PM)</span>
                <span className={stockSaleResult >= 0 ? 'text-accent' : 'text-danger'}>
                  {stockSaleResult >= 0 ? '+' : ''}
                  {formatBRL(stockSaleResult)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{irLabel}</span>
              <span className="text-danger">-{formatBRL(result.ir)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
              <span className="text-foreground">Lucro líquido</span>
              <span className={result.netProfit >= 0 ? 'text-accent' : 'text-danger'}>{formatBRL(result.netProfit)}</span>
            </div>
            {hasCommission && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Sua comissão ({operation.holder!.commission_pct}%)</span>
                  <span className="text-warning">{formatBRL(commission.commissionAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                  <span className="text-foreground">Líquido para {operation.holder!.name}</span>
                  <span className={commission.holderNetAfterCommission >= 0 ? 'text-accent' : 'text-danger'}>
                    {formatBRL(commission.holderNetAfterCommission)}
                  </span>
                </div>
              </>
            )}
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
