'use client';

import { Wallet } from 'lucide-react';
import { formatBRL } from '@/lib/utils';

interface EquityCompositionPanelProps {
  initialEquity: number | null;
  equityImpactingProfit: number;
  totalCommissions: number;
  totalWithdrawn: number;
  emergencyReserve: number;
  currentEquity: number | null;
}

/**
 * Mostra a composição completa do Patrimônio Atual, parcela por
 * parcela, para deixar claro de onde vem o número final — não é só
 * Patrimônio Inicial + Reserva, também soma lucro acumulado e
 * comissões, e desconta saques.
 */
export function EquityCompositionPanel({
  initialEquity,
  equityImpactingProfit,
  totalCommissions,
  totalWithdrawn,
  emergencyReserve,
  currentEquity,
}: EquityCompositionPanelProps) {
  if (initialEquity === null) return null;

  const rows: { label: string; value: number; showSign: boolean }[] = [
    { label: 'Patrimônio Inicial', value: initialEquity, showSign: false },
    { label: 'Lucro acumulado (operações)', value: equityImpactingProfit, showSign: true },
    { label: 'Comissões recebidas', value: totalCommissions, showSign: true },
    { label: 'Saques', value: -totalWithdrawn, showSign: true },
    { label: 'Reserva de emergência', value: emergencyReserve, showSign: true },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-start gap-2">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="flex-1 space-y-2">
          <span className="text-sm text-foreground">Como o Patrimônio Atual é calculado</span>
          <div className="flex flex-col gap-1">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-tabular text-foreground">
                  {r.showSign && (r.value >= 0 ? '+ ' : '− ')}
                  {formatBRL(Math.abs(r.value))}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-xs font-bold">
              <span className="text-foreground">Patrimônio Atual</span>
              <span className="font-tabular text-accent">{formatBRL(currentEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
