'use client';

import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  calculateMaxContracts,
  calculateRequiredCapital,
  calculateExpectedPremium,
  calculateNetProfit,
  calculateProfitability,
  calculatePremiumRate,
  calculateStrikeDistance,
  type OptionType,
} from '@/lib/calculations/finance';
import { formatBRL, formatPct } from '@/lib/utils';

function useNumberField(initial = '') {
  const [raw, setRaw] = useState(initial);
  const value = useMemo(() => {
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [raw]);
  return { raw, setRaw, value };
}

export default function CalculadorasPage() {
  const [optionType, setOptionType] = useState<OptionType>('PUT');
  const cash = useNumberField('10000');
  const quote = useNumberField('60');
  const strike = useNumberField('58');
  const premium = useNumberField('0.80');
  const quantity = useNumberField('1');
  const buyback = useNumberField('0');
  const daysHeld = useNumberField('5');

  const maxContracts = calculateMaxContracts({ availableCash: cash.value, strike: strike.value });
  const requiredCapital = calculateRequiredCapital({ strike: strike.value, quantity: quantity.value });
  const expectedPremium = calculateExpectedPremium({ premium: premium.value, quantity: quantity.value });
  const net = calculateNetProfit({ optionType, premiumReceived: expectedPremium, buybackCost: buyback.value });
  const profitability = calculateProfitability({
    netProfit: net.netProfit,
    committedCapital: requiredCapital,
    daysHeld: daysHeld.value,
  });
  const rate = calculatePremiumRate(optionType, premium.value, quote.value, strike.value);
  const distance = calculateStrikeDistance(quote.value, strike.value);

  const exceedsCash = requiredCapital > cash.value && cash.value > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Calculadoras</h1>
        <p className="text-sm text-muted-foreground">Dimensione a operação antes de executar.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Calculator className="h-4 w-4 text-accent" />
              Dados da operação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['PUT', 'CALL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOptionType(t)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      optionType === t
                        ? 'border-accent/50 bg-accent-muted text-accent'
                        : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover'
                    }`}
                  >
                    {t === 'PUT' ? 'PUT (Cash Secured)' : 'CALL (Covered)'}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Caixa disponível (R$)" field={cash} />
            <Field label="Cotação atual (R$)" field={quote} />
            <Field label="Strike (R$)" field={strike} />
            <Field label="Prêmio por ação (R$)" field={premium} />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Quantidade de contratos</Label>
                {cash.value > 0 && strike.value > 0 && (
                  <button
                    type="button"
                    onClick={() => quantity.setRaw(String(maxContracts))}
                    className="text-[11px] font-medium text-accent hover:underline"
                  >
                    usar máximo ({maxContracts})
                  </button>
                )}
              </div>
              <Input
                value={quantity.raw}
                onChange={(e) => quantity.setRaw(e.target.value)}
                className={`font-tabular ${exceedsCash ? 'border-danger/50 focus-visible:ring-danger/50' : ''}`}
              />
            </div>
            <Field label="Custo de recompra, se houver (R$)" field={buyback} />
            <Field label="Dias em carteira (para anualizar)" field={daysHeld} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={exceedsCash ? 'border-danger/40' : undefined}>
            <CardHeader>
              <CardTitle>Dimensionamento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric label="Contratos máximos" value={String(maxContracts)} />
              <Metric label="Capital necessário" value={formatBRL(requiredCapital)} accent={exceedsCash ? 'danger' : undefined} />
              <Metric
                label="Excede caixa?"
                value={exceedsCash ? 'Sim' : 'Não'}
                accent={exceedsCash ? 'danger' : 'accent'}
              />
              <Metric label="% do caixa comprometido" value={formatPct(cash.value > 0 ? (requiredCapital / cash.value) * 100 : 0, 1)} />
            </CardContent>
            {exceedsCash && (
              <div className="mx-5 mb-4 rounded-lg border border-danger/25 bg-danger-muted px-3 py-2 text-xs text-danger">
                Essa quantidade excede seu caixa disponível em {formatBRL(requiredCapital - cash.value)}. Máximo
                seguro: {maxContracts} contrato{maxContracts === 1 ? '' : 's'}.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strike</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric label="Distância" value={formatPct(distance * 100, 2)} accent={distance >= 0 ? 'accent' : 'danger'} />
              <Metric
                label={`Taxa (prêmio/${optionType === 'PUT' ? 'strike' : 'cotação'})`}
                value={formatPct(rate * 100, 2)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado esperado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric label="Prêmio esperado" value={formatBRL(expectedPremium)} accent="accent" />
              <Metric
                label={optionType === 'PUT' ? 'IR (15% s/ prêmio-recompra)' : 'IR (15% s/ prêmio bruto)'}
                value={formatBRL(net.ir)}
                accent="danger"
              />
              <Metric label="Lucro líquido" value={formatBRL(net.netProfit)} accent={net.netProfit >= 0 ? 'accent' : 'danger'} />
              <Metric label="Rentabilidade total" value={formatPct(profitability.totalPct, 2)} />
              <Metric label="Rentabilidade anualizada" value={formatPct(profitability.annualizedPct, 1)} accent="accent" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, field }: { label: string; field: ReturnType<typeof useNumberField> }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={field.raw} onChange={(e) => field.setRaw(e.target.value)} className="font-tabular" />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: 'accent' | 'danger' }) {
  return (
    <div>
      <p className="text-[11px] text-faint-foreground">{label}</p>
      <p
        className={`font-tabular text-base font-semibold ${
          accent === 'accent' ? 'text-accent' : accent === 'danger' ? 'text-danger' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
