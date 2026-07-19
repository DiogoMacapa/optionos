'use client';

import { Receipt } from 'lucide-react';
import { formatBRL } from '@/lib/utils';

interface IrCreditPanelProps {
  irLossToOffset: number;
}

/**
 * Exibe o saldo de prejuízo ainda não compensado, informado manualmente
 * pelo usuário em Configurações — não é calculado pelo OptionOS. O
 * usuário já usa um app externo dedicado que calcula a compensação de
 * IR mês a mês (com regras de swing/day trade, isenções, etc.) — este
 * painel é só um espelho de referência, informativo, separado do
 * Patrimônio (não soma nele, pois esse valor ainda não é dinheiro real
 * disponível, é uma economia de imposto futura e incerta).
 */
export function IrCreditPanel({ irLossToOffset }: IrCreditPanelProps) {
  if (irLossToOffset <= 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/10 px-4 py-3 text-sm text-info">
      <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        Você tem <strong>{formatBRL(irLossToOffset)}</strong> em prejuízo ainda não compensado (informado
        manualmente em Configurações, com base no seu app de IR). Esse valor não entra no Patrimônio — é uma
        economia de imposto futura, não caixa disponível hoje.
      </div>
    </div>
  );
}
