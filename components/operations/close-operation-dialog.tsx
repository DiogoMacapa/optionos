'use client';

import { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { calculateNetProfit, calculateStockSaleResult, calculateCommission } from '@/lib/calculations/finance';
import { formatBRL, parseBRNumber } from '@/lib/utils';
import { GlossaryTerm } from '@/components/shared/glossary-term';
import type { Operation } from '@/lib/types/database';
import type { CloseOperationInput, NewOperationInput } from '@/lib/supabase/queries';

interface CloseOperationDialogProps {
  operation: Operation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CloseOperationInput) => Promise<void>;
  /** Chamado quando o usuário escolhe "Rolei" — pai cuida de encerrar+abrir via rollOperation. */
  onRoll: (buybackCost: number, newOperation: NewOperationInput) => Promise<void>;
  /** Preço médio das ações (só relevante se for CALL e puder ser exercida). */
  averagePrice?: number | null;
  /** IR congelado (Configurações) — enquanto true, toda operação encerrada tem IR = 0. */
  irFrozen?: boolean;
}

type OutcomeType = 'expirou' | 'recomprou' | 'exercida' | 'rolou';

export function CloseOperationDialog({
  operation,
  open,
  onOpenChange,
  onConfirm,
  onRoll,
  averagePrice,
  irFrozen = false,
}: CloseOperationDialogProps) {
  const [outcome, setOutcome] = useState<OutcomeType>('expirou');
  const [buybackCostPerShare, setBuybackCostPerShare] = useState('0');
  const [saving, setSaving] = useState(false);

  // Campos da nova operação (rolagem)
  const [rollStrike, setRollStrike] = useState('');
  const [rollPremium, setRollPremium] = useState('');
  const [rollQuantity, setRollQuantity] = useState(String(operation.quantity));
  const [rollExpiration, setRollExpiration] = useState('');

  const totalPremium = operation.premium_received;
  // Usuário digita o custo de recompra POR AÇÃO — o total é sempre derivado
  // multiplicando pela quantidade, igual já funciona nas tabelas PUT/CALL
  // (Valor Recompra × Qnt = Total Recompra).
  const cost = outcome === 'expirou' ? 0 : parseBRNumber(buybackCostPerShare) * operation.quantity;
  const exercised = outcome === 'exercida';
  const isRolling = outcome === 'rolou';
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
        irFrozen,
      }),
    [operation.option_type, totalPremium, cost, exercised, stockSaleResult, irFrozen]
  );

  const commission = useMemo(
    () =>
      hasCommission
        ? calculateCommission({ netProfit: result.netProfit, commissionPct: operation.holder!.commission_pct })
        : { commissionAmount: 0, holderNetAfterCommission: result.netProfit },
    [hasCommission, result.netProfit, operation.holder]
  );

  const rollFormValid =
    rollStrike.trim() !== '' && rollPremium.trim() !== '' && rollQuantity.trim() !== '' && rollExpiration.trim() !== '';

  async function handleConfirm() {
    setSaving(true);
    try {
      if (isRolling) {
        if (!rollFormValid) return;
        await onRoll(cost, {
          assetId: operation.asset_id,
          holderId: operation.holder_id,
          opportunityId: null,
          optionType: operation.option_type,
          strike: parseBRNumber(rollStrike),
          expiration: rollExpiration,
          quantity: Math.round(parseBRNumber(rollQuantity)),
          premiumReceived: parseBRNumber(rollPremium) * Math.round(parseBRNumber(rollQuantity)),
          deltaAtOpen: null,
          committedCapital: operation.committed_capital,
          stockPositionId: operation.stock_position_id,
        });
        return;
      }
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

  const irLabel = irFrozen
    ? 'IR (congelado — compensando prejuízo)'
    : operation.option_type === 'PUT'
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
                <SelectItem value="rolou">Rolei para outra opção</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-faint-foreground">
              <GlossaryTerm termKey="exercicio">O que é exercício?</GlossaryTerm> · <GlossaryTerm termKey="rolagem">O que é rolagem?</GlossaryTerm>
            </p>
          </div>

          {(outcome === 'recomprou' || isRolling) && (
            <div className="space-y-1">
              <Label htmlFor="buyback">
                {isRolling ? 'Custo de recompra da posição atual (por ação)' : 'Custo de recompra (por ação)'}
              </Label>
              <Input
                id="buyback"
                value={buybackCostPerShare}
                onChange={(e) => setBuybackCostPerShare(e.target.value)}
                className="font-tabular"
                placeholder="0,00"
              />
              {cost > 0 && (
                <p className="text-[11px] text-faint-foreground">Total: {formatBRL(cost)} ({operation.quantity} ações)</p>
              )}
            </div>
          )}

          {isRolling && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <RefreshCw className="h-3.5 w-3.5 text-accent" />
                Nova operação (rolagem)
              </div>
              <p className="text-[11px] text-muted-foreground">
                Informe os dados da nova opção vendida. A operação atual será marcada como &quot;rolada&quot; e vinculada a esta.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label>Novo strike</Label>
                  <Input className="font-tabular" value={rollStrike} onChange={(e) => setRollStrike(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label>Novo prêmio (por ação)</Label>
                  <Input className="font-tabular" value={rollPremium} onChange={(e) => setRollPremium(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label>Nova quantidade</Label>
                  <Input className="font-tabular" value={rollQuantity} onChange={(e) => setRollQuantity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Novo vencimento</Label>
                  <Input type="date" className="font-tabular" value={rollExpiration} onChange={(e) => setRollExpiration(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {exercised && operation.option_type === 'CALL' && !averagePrice && (
            <p className="rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 text-xs text-warning">
              Nenhum preço médio (PM) cadastrado para este ativo — o resultado da venda das ações não será
              incluído no cálculo do IR. Cadastre o PM em Configurações para um cálculo completo.
            </p>
          )}

          {!isRolling && (
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
          )}

          {isRolling && cost > 0 && (
            <div className="rounded-lg border border-border bg-surface-elevated p-3 font-tabular text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Custo de recompra desta perna</span>
                <span className="text-danger">-{formatBRL(cost)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || (isRolling && !rollFormValid)} onClick={handleConfirm}>
              {saving ? 'Salvando…' : isRolling ? 'Confirmar rolagem' : 'Confirmar encerramento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
