'use client';

import { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  Coins,
  PiggyBank,
  Lock,
  Layers,
  Target,
  Percent,
  Sparkles,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { LineChartCard } from '@/components/dashboard/line-chart-card';
import { PieChartCard } from '@/components/dashboard/pie-chart-card';
import { BarChartCard } from '@/components/dashboard/bar-chart-card';
import { Button } from '@/components/ui/button';
import { AiAnalysisDialog } from '@/components/shared/ai-analysis-dialog';
import { useDashboardData, computeKpis, filterByHolder } from '@/lib/hooks/use-dashboard-data';
import { buildPortfolioAnalysisPrompt } from '@/lib/ai/prompt-builder';
import { formatBRL, formatPct } from '@/lib/utils';

export default function DashboardPage() {
  const { operations: allOperations, equityHistory: allEquityHistory, holders, loading, error } = useDashboardData();
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [holderFilter, setHolderFilter] = useState<string | null>(null); // null = todos

  const { operations, equityHistory } = filterByHolder(allOperations, allEquityHistory, holderFilter);
  const kpis = computeKpis(operations, equityHistory);

  const equitySeries = equityHistory.map((e) => ({ date: e.recorded_at, value: e.total_equity }));
  const premiumSeries = equityHistory.map((e) => ({ date: e.recorded_at, value: e.cumulative_premiums }));
  const profitSeries = equityHistory.map((e) => ({ date: e.recorded_at, value: e.cumulative_profit }));

  const latestEquity = equityHistory[equityHistory.length - 1];
  const equityCompositionData = latestEquity
    ? [
        { name: 'Comprometido', value: latestEquity.committed_capital, color: 'var(--info)' },
        { name: 'Caixa livre', value: latestEquity.free_cash, color: 'var(--accent)' },
      ]
    : [];

  const exercisedCount = operations.filter((o) => o.exercised).length;
  const nonExercisedCount = operations.filter((o) => o.status !== 'aberta' && !o.exercised).length;

  const statusDistribution = ['aberta', 'encerrada', 'rolada', 'exercida'].map((status) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: operations.filter((o) => o.status === status).length,
    color:
      status === 'aberta'
        ? 'var(--info)'
        : status === 'encerrada'
        ? 'var(--accent)'
        : status === 'rolada'
        ? 'var(--warning)'
        : 'var(--danger)',
  }));

  const profitByAsset = Object.entries(
    operations.reduce<Record<string, number>>((acc, o) => {
      const ticker = o.asset?.ticker ?? '—';
      acc[ticker] = (acc[ticker] || 0) + (o.net_profit || 0);
      return acc;
    }, {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const monthlyResult = Object.entries(
    operations
      .filter((o) => o.closed_at)
      .reduce<Record<string, number>>((acc, o) => {
        const month = new Date(o.closed_at as string).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        acc[month] = (acc[month] || 0) + (o.net_profit || 0);
        return acc;
      }, {})
  ).map(([label, value]) => ({ label, value }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {holderFilter === null ? 'Soma de todos os titulares.' : `Apenas operações de ${holders.find((h) => h.id === holderFilter)?.name}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {holders.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
              <button
                onClick={() => setHolderFilter(null)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  holderFilter === null ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
                }`}
              >
                Todos
              </button>
              {holders.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHolderFilter(h.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    holderFilter === h.id ? 'bg-accent-muted text-accent' : 'text-muted-foreground hover:bg-surface-hover'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
          {operations.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setAnalyzeOpen(true)}>
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Analisar Carteira
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">
          Erro ao carregar dados: {error}. Verifique a conexão com o Supabase em Configurações.
        </div>
      )}

      {!loading && operations.length === 0 && !error && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          Nenhuma operação registrada ainda. Importe um print em <strong className="text-foreground">Oportunidades</strong> ou registre uma operação manualmente para começar a ver dados aqui.
        </div>
      )}

      {/* KPIs superiores */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Patrimônio Atual" value={formatBRL(kpis.currentEquity)} icon={Wallet} accent="accent" />
        <KpiCard label="Patrimônio Inicial" value={formatBRL(kpis.initialEquity)} icon={Wallet} />
        <KpiCard label="Lucro Total" value={formatBRL(kpis.totalProfit)} icon={TrendingUp} accent={kpis.totalProfit >= 0 ? 'accent' : 'danger'} />
        <KpiCard label="Prêmios Recebidos" value={formatBRL(kpis.totalPremiums)} icon={Coins} accent="accent" />
        <KpiCard label="Caixa Livre" value={formatBRL(kpis.freeCash)} icon={PiggyBank} />
        <KpiCard label="Capital Comprometido" value={formatBRL(kpis.committedCapital)} icon={Lock} />
        <KpiCard label="Operações Abertas" value={String(kpis.openOperationsCount)} icon={Layers} />
        <KpiCard label="Taxa de Sucesso" value={formatPct(kpis.successRatePct, 1)} icon={Target} accent="accent" />
      </div>

      {/* Gráficos de evolução */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LineChartCard title="Evolução Patrimonial" data={equitySeries} />
        <LineChartCard title="Evolução dos Prêmios" data={premiumSeries} color="var(--info)" />
        <LineChartCard title="Evolução do Lucro" data={profitSeries} color="var(--accent)" />
        <PieChartCard title="Patrimônio × Caixa" data={equityCompositionData} emptyLabel="Sem snapshot de patrimônio ainda." />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BarChartCard
          title="Ativos Mais Lucrativos"
          data={profitByAsset}
          layout="vertical"
          colorFn={(v) => (v >= 0 ? 'var(--accent)' : 'var(--danger)')}
        />
        <BarChartCard
          title="Resultado Mensal"
          data={monthlyResult}
          layout="horizontal"
          colorFn={(v) => (v >= 0 ? 'var(--accent)' : 'var(--danger)')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PieChartCard title="Distribuição das Operações" data={statusDistribution} />
        <PieChartCard
          title="Exercidas × Não Exercidas"
          data={[
            { name: 'Exercidas', value: exercisedCount, color: 'var(--danger)' },
            { name: 'Não Exercidas', value: nonExercisedCount, color: 'var(--accent)' },
          ]}
        />
      </div>

      {equityHistory.length < 2 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-4 py-2.5">
          <Percent className="h-3.5 w-3.5 text-faint-foreground" />
          <p className="text-xs text-faint-foreground">
            Os gráficos de evolução ganham forma assim que houver pelo menos 2 registros de patrimônio para este titular (equity_snapshots).
          </p>
        </div>
      )}

      <AiAnalysisDialog
        open={analyzeOpen}
        onOpenChange={setAnalyzeOpen}
        title="Analisar Carteira"
        prompt={buildPortfolioAnalysisPrompt(operations)}
      />
    </div>
  );
}
