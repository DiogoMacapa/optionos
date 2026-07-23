'use client';

import { Wallet, TrendingUp, Handshake, PiggyBank, Shield } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
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
 * Mostra a composição do Patrimônio Atual em cards — não é só
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

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">Como o Patrimônio Atual é calculado</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Patrimônio Inicial" value={formatBRL(initialEquity)} icon={Wallet} />
        <KpiCard
          label="Lucro Acumulado"
          value={formatBRL(equityImpactingProfit)}
          icon={TrendingUp}
          accent={equityImpactingProfit >= 0 ? 'accent' : 'danger'}
        />
        <KpiCard label="Comissões" value={formatBRL(totalCommissions)} icon={Handshake} accent="accent" />
        <KpiCard label="Saques" value={formatBRL(totalWithdrawn)} icon={PiggyBank} />
        <KpiCard label="Reserva de Emergência" value={formatBRL(emergencyReserve)} icon={Shield} />
        <KpiCard label="= Patrimônio Atual" value={formatBRL(currentEquity)} icon={Wallet} accent="accent" />
      </div>
    </div>
  );
}
