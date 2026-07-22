'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Receipt,
  AlertTriangle,
  Handshake,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { LineChartCard } from '@/components/dashboard/line-chart-card';
import { PieChartCard } from '@/components/dashboard/pie-chart-card';
import { BarChartCard } from '@/components/dashboard/bar-chart-card';
import { IrCreditPanel } from '@/components/dashboard/ir-credit-panel';
import { CommissionPanel } from '@/components/dashboard/commission-panel';
import { WithdrawalPanel } from '@/components/dashboard/withdrawal-panel';
import { KpiDetailDialog } from '@/components/dashboard/kpi-detail-dialog';
import { Button } from '@/components/ui/button';
import { AiAnalysisDialog } from '@/components/shared/ai-analysis-dialog';
import { useDashboardData, computeKpis, filterByHolder } from '@/lib/hooks/use-dashboard-data';
import { buildPortfolioAnalysisPrompt } from '@/lib/ai/prompt-builder';
import { formatBRL, formatPct } from '@/lib/utils';
import {
  mostProfitableAssets,
  overallStats,
  mostProfitableDeltaBands,
  bestOpeningWeekdays,
  bestHoldingPeriods,
} from '@/lib/learning/statistics';

export default function DashboardPage() {
  const router = useRouter();
  const [detailKind, setDetailKind] = useState<'profit' | 'premiums' | 'commissions' | 'withdrawals' | null>(null);
  const {
    operations: allOperations,
    holders,
    strategySettings,
    withdrawals: allWithdrawals,
    commissionEntries,
    loading,
    error,
    refetch: refetchDashboard,
  } = useDashboardData();
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [holderFilter, setHolderFilter] = useState<string | null>(null); // null = todos

  const { operations, withdrawals } = filterByHolder(allOperations, holderFilter, allWithdrawals);
  const kpis = computeKpis(operations, strategySettings, withdrawals, commissionEntries);

  const closedChronological = [...operations]
    .filter((o) => o.status !== 'aberta' && o.net_profit !== null && o.closed_at)
    .sort((a, b) => new Date(a.closed_at as string).getTime() - new Date(b.closed_at as string).getTime());

  const premiumSeries = closedChronological.reduce<{ date: string; value: number }[]>((acc, o) => {
    const previous = acc.length > 0 ? acc[acc.length - 1].value : 0;
    acc.push({ date: (o.closed_at as string).slice(0, 10), value: previous + o.premium_received });
    return acc;
  }, []);

  // Evolução do Lucro reflete sempre o LUCRO LÍQUIDO acumulado (já com IR descontado).
  const profitSeries = closedChronological.reduce<{ date: string; value: number }[]>((acc, o) => {
    const previous = acc.length > 0 ? acc[acc.length - 1].value : 0;
    acc.push({ date: (o.closed_at as string).slice(0, 10), value: previous + (o.net_profit ?? 0) });
    return acc;
  }, []);

  // Evolução Patrimonial: mostra a trajetória completa (histórico + operações
  // novas), começando do Patrimônio Inicial informado. Diferente do KPI
  // "Patrimônio Atual" (que só soma operações com counts_toward_equity=true,
  // para não contar de novo um histórico já embutido no valor informado) —
  // aqui é só visualização da trajetória, o usuário quer ver a curva completa.
  const equitySeries = (() => {
    const initial = kpis.initialEquity;
    if (initial === null) return [];
    type Event = { date: string; delta: number };
    const events: Event[] = [
      ...closedChronological.map((o) => ({ date: (o.closed_at as string).slice(0, 10), delta: o.net_profit ?? 0 })),
      ...withdrawals.map((w) => ({ date: w.withdrawn_at, delta: -w.amount })),
      ...commissionEntries.map((c) => ({ date: c.received_at, delta: c.amount })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return events.reduce<{ date: string; value: number }[]>((acc, ev) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].value : initial;
      acc.push({ date: ev.date, value: previous + ev.delta });
      return acc;
    }, []);
  })();

  const commissionSeries = commissionEntries.reduce<{ date: string; value: number }[]>((acc, c) => {
    const previous = acc.length > 0 ? acc[acc.length - 1].value : 0;
    acc.push({ date: c.received_at, value: previous + c.amount });
    return acc;
  }, []);

  const withdrawalSeries = [...withdrawals]
    .sort((a, b) => new Date(a.withdrawn_at).getTime() - new Date(b.withdrawn_at).getTime())
    .reduce<{ date: string; value: number }[]>((acc, w) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].value : 0;
      acc.push({ date: w.withdrawn_at, value: previous + w.amount });
      return acc;
    }, []);

  // Evolução do IR Pago: acumulado ao longo do tempo, na data de encerramento
  // de cada operação — mesma regra já usada no KPI "Total de IR Pago" (só
  // conta IR de operações com resultado bruto positivo, nunca negativo).
  const irPaidSeries = closedChronological
    .filter((o) => o.ir_amount && (o.gross_result ?? 0) > 0)
    .reduce<{ date: string; value: number }[]>((acc, o) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].value : 0;
      acc.push({ date: (o.closed_at as string).slice(0, 10), value: previous + (o.ir_amount ?? 0) });
      return acc;
    }, []);

  const equityCompositionData =
    kpis.freeCash !== null
      ? [
          { name: 'Comprometido', value: kpis.committedCapital, color: 'var(--info)' },
          { name: 'Caixa livre', value: kpis.freeCash, color: 'var(--accent)' },
        ]
      : [];

  const exercisedCount = operations.filter((o) => o.exercised_label === 'Sim').length;
  const nonExercisedCount = operations.filter((o) => o.status !== 'aberta' && o.exercised_label === 'Não').length;

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

  const profitByAsset = mostProfitableAssets(operations)
    .slice(0, 6)
    .map((a) => ({ label: a.ticker, value: a.totalProfit }));

  const learning = overallStats(operations);
  const deltaBands = mostProfitableDeltaBands(operations)
    .slice(0, 6)
    .map((d) => ({ label: d.label, value: d.avgProfit }));
  const openingWeekdayStats = bestOpeningWeekdays(operations).map((w) => ({ label: w.weekday.slice(0, 3), value: w.avgProfit }));
  const holdingPeriodStats = bestHoldingPeriods(operations).map((h) => ({ label: h.label, value: h.avgProfit }));

  const monthlyResult = Object.entries(
    operations
      .filter((o) => o.closed_at)
      .reduce<Record<string, number>>((acc, o) => {
        const d = new Date(o.closed_at as string);
        const sortKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`; // ex: "2026-03" — ordena corretamente
        acc[sortKey] = (acc[sortKey] || 0) + (o.net_profit || 0);
        return acc;
      }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b)) // mais antigo primeiro (esquerda) → mais recente por último (direita)
    .map(([sortKey, value]) => {
      const [year, month] = sortKey.split('-').map(Number);
      const label = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      return { label, value };
    });

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
          Nenhuma operação registrada ainda. Registre uma operação em <strong className="text-foreground">Operações</strong> para começar a ver dados aqui.
        </div>
      )}

      {kpis.currentEquity === null && !loading && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-muted px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Informe o <strong>Patrimônio Inicial</strong> em Configurações → Estratégia — só precisa fazer isso
            uma vez (o caixa que você tinha antes da primeira operação no sistema). Daí em diante, Patrimônio,
            Caixa Livre e Capital Comprometido são calculados automaticamente a partir do seu histórico de
            operações, sem precisar atualizar nada manualmente.
          </div>
        </div>
      )}

      <IrCreditPanel irLossToOffset={strategySettings?.ir_loss_to_offset ?? 0} />

      <CommissionPanel entries={commissionEntries} onChanged={refetchDashboard} />

      <WithdrawalPanel entries={withdrawals} onChanged={refetchDashboard} />

      {/* KPIs superiores */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Patrimônio Atual" value={formatBRL(kpis.currentEquity)} icon={Wallet} accent="accent" />
        <KpiCard label="Patrimônio Inicial" value={formatBRL(kpis.initialEquity)} icon={Wallet} />
        <KpiCard
          label="Lucro Total (líquido)"
          value={formatBRL(kpis.totalProfit)}
          icon={TrendingUp}
          accent={kpis.totalProfit >= 0 ? 'accent' : 'danger'}
          onClick={() => setDetailKind('profit')}
        />
        <KpiCard
          label="Prêmios Recebidos (bruto)"
          value={formatBRL(kpis.totalPremiums)}
          icon={Coins}
          accent="accent"
          onClick={() => setDetailKind('premiums')}
        />
        <KpiCard label="Total de IR Pago" value={formatBRL(kpis.totalIrPaid)} icon={Receipt} accent="danger" />
        <KpiCard
          label="Total Sacado"
          value={formatBRL(kpis.totalWithdrawn)}
          icon={PiggyBank}
          onClick={() => setDetailKind('withdrawals')}
        />
        <KpiCard
          label="Comissões Recebidas"
          value={formatBRL(kpis.totalCommissions)}
          icon={Handshake}
          accent="accent"
          onClick={() => setDetailKind('commissions')}
        />
        <KpiCard label="Caixa Livre" value={formatBRL(kpis.freeCash)} icon={PiggyBank} />
        <KpiCard label="Capital Comprometido" value={formatBRL(kpis.committedCapital)} icon={Lock} />
        <KpiCard
          label="Operações Abertas"
          value={String(kpis.openOperationsCount)}
          icon={Layers}
          onClick={() => router.push('/operacoes')}
        />
        <KpiCard label="Taxa de Sucesso" value={formatPct(kpis.successRatePct, 1)} icon={Target} accent="accent" />
      </div>

      {/* Gráficos de evolução */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LineChartCard title="Evolução Patrimonial" data={equitySeries} emptyLabel="Informe o Patrimônio Inicial em Configurações." />
        <LineChartCard title="Evolução dos Prêmios (bruto)" data={premiumSeries} color="var(--info)" />
        <LineChartCard title="Evolução do Lucro (líquido, pós-IR)" data={profitSeries} color="var(--accent)" />
        <LineChartCard title="Evolução do IR Pago" data={irPaidSeries} color="var(--danger)" emptyLabel="Nenhum IR pago ainda." />
        <LineChartCard title="Evolução dos Saques" data={withdrawalSeries} color="var(--warning)" emptyLabel="Nenhum saque lançado ainda." />
        <LineChartCard title="Evolução das Comissões" data={commissionSeries} color="var(--accent)" emptyLabel="Nenhuma comissão lançada ainda." />
        <PieChartCard title="Patrimônio × Caixa" data={equityCompositionData} emptyLabel="Informe o Patrimônio Inicial em Configurações." />
      </div>

      <PieChartCard title="Distribuição das Operações" data={statusDistribution} />

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

      <PieChartCard
        title="Exercidas × Não Exercidas"
        data={[
          { name: 'Exercidas', value: exercisedCount, color: 'var(--danger)' },
          { name: 'Não Exercidas', value: nonExercisedCount, color: 'var(--accent)' },
        ]}
      />

      {/* Aprendizado: estatísticas agregadas do histórico real (só operações fechadas) */}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Aprendizado</h2>
        <p className="text-xs text-muted-foreground">
          Análise estatística do seu histórico — considera apenas operações já fechadas (encerradas, exercidas ou roladas).
        </p>
      </div>

      {learning.operationsCount === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          Nenhuma operação fechada ainda. As estatísticas de aprendizado aparecem aqui assim que você encerrar, for exercido, ou rolar sua primeira operação.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Prêmio Médio" value={formatBRL(learning.averagePremium)} icon={Coins} />
            <KpiCard label="Taxa de Exercício" value={formatPct(learning.exerciseRatePct, 1)} icon={Percent} />
            <KpiCard label="Taxa de Sucesso (fechadas)" value={formatPct(learning.successRatePct, 1)} icon={Target} accent="accent" />
            <KpiCard
              label="Lucro Médio"
              value={formatBRL(learning.averageProfit)}
              icon={TrendingUp}
              accent={(learning.averageProfit ?? 0) >= 0 ? 'accent' : 'danger'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BarChartCard
              title="Melhor Delta (lucro médio por faixa)"
              data={deltaBands}
              layout="vertical"
              colorFn={(v) => (v >= 0 ? 'var(--accent)' : 'var(--danger)')}
              emptyLabel="Sem operações com Delta registrado ainda."
            />
            <BarChartCard
              title="Melhor Dia da Semana para Operar (lucro médio)"
              data={openingWeekdayStats}
              layout="horizontal"
              colorFn={(v) => (v >= 0 ? 'var(--accent)' : 'var(--danger)')}
            />
          </div>

          <BarChartCard
            title="Melhor Prazo até o Vencimento (lucro médio por faixa de dias)"
            data={holdingPeriodStats}
            layout="horizontal"
            colorFn={(v) => (v >= 0 ? 'var(--accent)' : 'var(--danger)')}
          />
        </>
      )}

      <AiAnalysisDialog
        open={analyzeOpen}
        onOpenChange={setAnalyzeOpen}
        title="Analisar Carteira"
        prompt={buildPortfolioAnalysisPrompt(operations)}
      />

      <KpiDetailDialog
        kind={detailKind}
        onClose={() => setDetailKind(null)}
        operations={operations}
        commissionEntries={commissionEntries}
        withdrawals={withdrawals}
      />
    </div>
  );
}
