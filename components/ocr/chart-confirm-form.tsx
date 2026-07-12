'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ParsedChartData } from '@/lib/ocr/chart-regions';

interface FieldSpec {
  key: keyof ParsedChartData;
  label: string;
  regionId?: string; // para ligar à confiança da região
}

const FIELDS: FieldSpec[] = [
  { key: 'ticker', label: 'Ticker', regionId: 'header_price' },
  { key: 'lastPrice', label: 'Preço atual', regionId: 'header_price' },
  { key: 'changePct', label: 'Variação (%)', regionId: 'header_price' },
  { key: 'dayLow', label: 'Mín. dia', regionId: 'header_ranges' },
  { key: 'dayHigh', label: 'Máx. dia', regionId: 'header_ranges' },
  { key: 'week52Low', label: 'Mín. 52 sem.', regionId: 'header_ranges' },
  { key: 'week52High', label: 'Máx. 52 sem.', regionId: 'header_ranges' },
  { key: 'openPrice', label: 'Abertura', regionId: 'ohlc_legend' },
  { key: 'highPrice', label: 'Máxima', regionId: 'ohlc_legend' },
  { key: 'lowPrice', label: 'Mínima', regionId: 'ohlc_legend' },
  { key: 'closePrice', label: 'Fechamento', regionId: 'ohlc_legend' },
  { key: 'bbUpper', label: 'BB Superior', regionId: 'bollinger_legend' },
  { key: 'bbMiddle', label: 'BB Média', regionId: 'bollinger_legend' },
  { key: 'bbLower', label: 'BB Inferior', regionId: 'bollinger_legend' },
  { key: 'rsi14', label: 'RSI (14)', regionId: 'rsi_legend' },
  { key: 'macdLine', label: 'MACD linha', regionId: 'macd_legend' },
  { key: 'macdSignal', label: 'MACD sinal', regionId: 'macd_legend' },
  { key: 'macdHistogram', label: 'MACD histograma', regionId: 'macd_legend' },
];

interface ChartConfirmFormProps {
  data: Partial<ParsedChartData>;
  regionConfidences: Record<string, number>;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function ChartConfirmForm({ data, regionConfidences, onConfirm, onCancel }: ChartConfirmFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of FIELDS) {
      const raw = data[f.key];
      initial[f.key] = raw === null || raw === undefined ? '' : String(raw);
    }
    return initial;
  });

  const missingCount = FIELDS.filter((f) => !values[f.key]).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-muted px-3 py-2.5 text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Confira os valores antes de salvar. A leitura automática costuma acertar preço, variação, faixas e OHLC —
          revise com atenção os campos de indicadores técnicos, mais sensíveis a erro.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => {
          const confidence = f.regionId ? regionConfidences[f.regionId] : undefined;
          const low = confidence !== undefined && confidence < 0.7;
          return (
            <div key={f.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={f.key}>{f.label}</Label>
                {confidence !== undefined && (
                  <span className={low ? 'text-warning' : 'text-faint-foreground'} title="Confiança do OCR nesta região">
                    {low ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  </span>
                )}
              </div>
              <Input
                id={f.key}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder="—"
                className="font-tabular"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Badge variant={missingCount > 6 ? 'warning' : 'default'}>
          {missingCount} campo{missingCount === 1 ? '' : 's'} vazio{missingCount === 1 ? '' : 's'}
        </Badge>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(values)}>Salvar snapshot</Button>
        </div>
      </div>
    </div>
  );
}
