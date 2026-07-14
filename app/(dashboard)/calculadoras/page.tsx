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
  calculatePremiumRate,
  calculateStrikeDistance,
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
  const cash = useNumberField('10000');
  const quote = useNumberField('60');
  const strike = useNumberField('58');
  const premium = useNumberField('0.80');

  // Quantidade é sempre derivada — nunca editada diretamente pelo usuário.
  // Isso é o ponto central: o sistema decide quantas ações cabem no caixa.
  const quantity = calculateMaxContracts({ availableCash: cash.value, strike: strike.value });

  const requiredCapital = calculateRequiredCapital({ strike: strike.value, quantity });
  const expectedPremium = calculateExpectedPremium({ premium: premium.value, quantity });
  const net = calculateNetProfit({ optionType: 'PUT', premiumReceived: expectedPremium, buybackCost: 0 });
  const rate = calculatePremiumRate('PUT', premium.value, quote.value, strike.value);
  const distance = calculateStrikeDistance(quote.value, strike.value);

  const hasCoverage = requiredCapital <= cash.value;
  const pctCommitted = cash.value > 0 ? (requiredCapital / cash.value) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Calculadoras</h1>
        <p className="text-sm text-muted-foreground">Venda de PUT Cash Secured — dimensionamento automático.</p>
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
            <Field label="Caixa disponível (R$)" field={cash} />
            <Field label="Cotação atual (R$)" field={quote} />
            <Field label="Strike (R$)" field={strike} />
            <Field label="Prêmio por ação (R$)" field={premium} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={!hasCoverage ? 'border-danger/40' : undefined}>
            <CardHeader>
              <CardTitle>Dimensionamento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric label="Quantidade de ações" value={quantity.toLocaleString('pt-BR')} accent="accent" />
              <Metric label="Capital necessário" value={formatBRL(requiredCapital)} />
              <Metric label="Tem cobertura?" value={hasCoverage ? 'Sim' : 'Não'} accent={hasCoverage ? 'accent' : 'danger'} />
              <Metric label="% do caixa comprometido" value={formatPct(pctCommitted, 1)} />
            </CardContent>
            {!hasCoverage && (
              <div className="mx-5 mb-4 rounded-lg border border-danger/25 bg-danger-muted px-3 py-2 text-xs text-danger">
                O caixa informado não cobre a quantidade calculada. Verifique os valores de caixa e strike.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strike</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric label="Distância" value={formatPct(distance * 100, 2)} accent={distance >= 0 ? 'accent' : 'danger'} />
              <Metric label="Taxa (prêmio/strike)" value={formatPct(rate * 100, 2)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado esperado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric label="Prêmio esperado" value={formatBRL(expectedPremium)} accent="accent" />
              <Metric label="IR (15% s/ prêmio)" value={formatBRL(net.ir)} accent="danger" />
              <Metric label="Lucro líquido" value={formatBRL(net.netProfit)} accent={net.netProfit >= 0 ? 'accent' : 'danger'} />
              <Metric
                label="Rentabilidade sobre o capital"
                value={formatPct(requiredCapital > 0 ? (net.netProfit / requiredCapital) * 100 : 0, 2)}
              />
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
