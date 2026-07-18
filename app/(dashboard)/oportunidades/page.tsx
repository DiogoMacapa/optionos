'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, LineChart, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OpportunityCard } from '@/components/opportunities/opportunity-card';
import { AiAnalysisDialog } from '@/components/shared/ai-analysis-dialog';
import { PrintDropzone } from '@/components/ocr/print-dropzone';
import { ChartConfirmForm } from '@/components/ocr/chart-confirm-form';
import { BookConfirmTable, type EditableBookRow } from '@/components/ocr/book-confirm-table';
import { useChartOcr } from '@/lib/hooks/use-chart-ocr';
import { useBookOcr } from '@/lib/hooks/use-book-ocr';
import { calculateScore } from '@/lib/scoring/engine';
import { buildOperationAnalysisPrompt } from '@/lib/ai/prompt-builder';
import { parseBRNumber } from '@/lib/utils';
import {
  findOrCreateAsset,
  createMarketSnapshot,
  latestSnapshotForAsset,
  insertOptionChainRows,
  getActiveScoreWeights,
  getStrategySettings,
  createOpportunity,
  listActiveOpportunities,
  discardOpportunity,
} from '@/lib/supabase/queries';
import type { Opportunity } from '@/lib/types/database';

type ImportStep = 'ticker' | 'chart' | 'chart-confirm' | 'book' | 'book-confirm' | 'done';

export default function OportunidadesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('ticker');
  const [ticker, setTicker] = useState('');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzingOp, setAnalyzingOp] = useState<Opportunity | null>(null);

  const chartOcr = useChartOcr();
  const bookOcr = useBookOcr();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listActiveOpportunities();
      setOpportunities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listActiveOpportunities();
        if (!cancelled) setOpportunities(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidades.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetImport() {
    setStep('ticker');
    setTicker('');
    setAssetId(null);
    setSnapshotId(null);
    setCurrentPrice(null);
    chartOcr.reset();
    bookOcr.reset();
  }

  function closeImport() {
    setImportOpen(false);
    resetImport();
  }

  async function handleTickerSubmit() {
    if (!ticker.trim()) return;
    try {
      const asset = await findOrCreateAsset(ticker);
      setAssetId(asset.id);
      // Se já existe snapshot recente, pula direto pro preço conhecido — mas sempre
      // deixa importar um novo print para atualizar.
      const latest = await latestSnapshotForAsset(asset.id);
      if (latest?.last_price) setCurrentPrice(latest.last_price);
      setStep('chart');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar ativo.');
    }
  }

  async function handleChartConfirm(values: Record<string, string>) {
    if (!assetId) return;
    setSaving(true);
    try {
      const num = (v: string) => (v === '' ? null : parseBRNumber(v));
      const snapshot = await createMarketSnapshot({
        assetId,
        source: 'investing',
        values: {
          last_price: num(values.lastPrice),
          change_pct: num(values.changePct),
          day_low: num(values.dayLow),
          day_high: num(values.dayHigh),
          week52_low: num(values.week52Low),
          week52_high: num(values.week52High),
          open_price: num(values.openPrice),
          high_price: num(values.highPrice),
          low_price: num(values.lowPrice),
          close_price: num(values.closePrice),
          bb_upper: num(values.bbUpper),
          bb_middle: num(values.bbMiddle),
          bb_lower: num(values.bbLower),
          rsi14: num(values.rsi14),
          macd_line: num(values.macdLine),
          macd_signal: num(values.macdSignal),
          macd_histogram: num(values.macdHistogram),
        },
        manuallyConfirmed: true,
      });
      setSnapshotId(snapshot.id);
      setCurrentPrice(snapshot.last_price ?? null);
      setStep('book');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar snapshot do gráfico.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBookConfirm(rows: EditableBookRow[]) {
    if (!assetId) return;
    setSaving(true);
    try {
      const inserted = await insertOptionChainRows(
        rows.map((r) => ({
          assetId,
          snapshotId,
          optionType: r.optionType,
          strike: r.strike!,
          expiration: r.expiration,
          premium: r.premium!,
          bid: r.bid,
          ask: r.ask,
          delta: r.delta,
          openInterest: r.openInterest,
          dailyVolume: r.volume,
          ocrConfidence: r.confidence === 'alta' ? 0.9 : r.confidence === 'media' ? 0.6 : 0.3,
          manuallyConfirmed: true,
        }))
      );

      const weights = await getActiveScoreWeights();
      const settings = await getStrategySettings();
      const price = currentPrice ?? 0;

      for (const entry of inserted) {
        const result = calculateScore({ entry, currentPrice: price, weights, settings });
        await createOpportunity({
          optionChainEntryId: entry.id,
          assetId,
          score: result.score,
          stars: result.stars,
          efficiencyPct: result.efficiencyPct,
          breakdown: result.breakdown,
          weightsUsedId: weights.id,
        });
      }

      setStep('done');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar linhas do book.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard(id: string) {
    await discardOpportunity(id);
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Central de Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Ranking de venda de opções por Score.</p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Plus className="h-4 w-4" />
          Importar print
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && opportunities.length === 0 && !error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <TrendingUp className="h-8 w-8 text-faint-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma oportunidade ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Importe um print do gráfico e do book de opções para gerar seu primeiro ranking.
            </p>
          </div>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Importar print
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {opportunities.map((op) => (
          <div key={op.id} className="group relative">
            <OpportunityCard
              opportunity={op}
              onAnalyze={() => setAnalyzingOp(op)}
            />
            <button
              onClick={() => handleDiscard(op.id)}
              className="absolute right-16 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-faint-foreground hover:bg-surface-hover hover:text-danger group-hover:block"
              title="Descartar oportunidade"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {analyzingOp && (
        <AiAnalysisDialog
          open={!!analyzingOp}
          onOpenChange={(open) => !open && setAnalyzingOp(null)}
          title={`Analisar operação — ${analyzingOp.asset?.ticker}`}
          prompt={buildOperationAnalysisPrompt(analyzingOp)}
        />
      )}

      {/* Modal de importação */}
      <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : closeImport())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar print</DialogTitle>
            <DialogDescription>
              Passo {stepIndex(step)} de 4 — {stepLabel(step)}
            </DialogDescription>
          </DialogHeader>

          {step === 'ticker' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="ticker">Ticker do ativo</Label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="Ex: VALE3"
                  className="font-tabular"
                  onKeyDown={(e) => e.key === 'Enter' && handleTickerSubmit()}
                />
              </div>
              <div className="flex justify-end">
                <Button disabled={!ticker.trim()} onClick={handleTickerSubmit}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 'chart' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LineChart className="h-4 w-4" />
                Print do gráfico ({ticker}) — Investing.com
              </div>
              <PrintDropzone
                onDrop={async (file) => {
                  await chartOcr.processImage(file);
                }}
                processing={chartOcr.status === 'processing'}
                progress={chartOcr.progress}
              />
              {chartOcr.status === 'done' && chartOcr.result && (
                <ChartConfirmForm
                  data={chartOcr.result}
                  regionConfidences={chartOcr.regionConfidences}
                  onConfirm={handleChartConfirm}
                  onCancel={() => chartOcr.reset()}
                />
              )}
              {chartOcr.status === 'error' && (
                <p className="text-sm text-danger">{chartOcr.error}</p>
              )}
            </div>
          )}

          {step === 'book' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                Print do book de opções ({ticker}) — BTG Pactual
              </div>
              <PrintDropzone
                onDrop={async (file) => {
                  await bookOcr.processImage(file);
                  setStep('book-confirm');
                }}
                processing={bookOcr.status === 'processing'}
                label="Arraste o print do book aqui"
                hint="Recorte a tabela de strikes antes de tirar o print, se possível"
              />
              {bookOcr.status === 'error' && <p className="text-sm text-danger">{bookOcr.error}</p>}
            </div>
          )}

          {step === 'book-confirm' && (
            <BookConfirmTable rows={bookOcr.rows} onConfirm={handleBookConfirm} onCancel={() => setStep('book')} />
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <p className="text-sm font-medium text-foreground">Oportunidades calculadas e adicionadas ao ranking.</p>
              <Button onClick={closeImport}>Concluir</Button>
            </div>
          )}

          {saving && <p className="text-xs text-muted-foreground">Salvando…</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function stepIndex(step: ImportStep): number {
  return { ticker: 1, chart: 2, 'chart-confirm': 2, book: 3, 'book-confirm': 3, done: 4 }[step];
}

function stepLabel(step: ImportStep): string {
  return {
    ticker: 'Informe o ativo',
    chart: 'Print do gráfico',
    'chart-confirm': 'Confirme os dados do gráfico',
    book: 'Print do book de opções',
    'book-confirm': 'Confirme as linhas do book',
    done: 'Concluído',
  }[step];
}
