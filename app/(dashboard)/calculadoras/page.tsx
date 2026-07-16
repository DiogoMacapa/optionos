'use client';

import { useState } from 'react';
import { Calculator, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, formatBRL, formatPct, parseBRNumber } from '@/lib/utils';

const ROUND_LOT = 100;

interface CalcRow {
  id: number;
  ticker: string;
  quote: string;
  strike: string;
  ceiling: string;
  premium: string;
}

function emptyRow(): CalcRow {
  return { id: Date.now() + Math.random(), ticker: '', quote: '', strike: '', ceiling: '', premium: '' };
}

const INITIAL_ROWS: CalcRow[] = [emptyRow(), emptyRow(), emptyRow()];

function calcRow(row: CalcRow, cash: number) {
  const strike = parseBRNumber(row.strike);
  const premium = parseBRNumber(row.premium);
  const ceiling = row.ceiling.trim() === '' ? null : parseBRNumber(row.ceiling);

  const rawQty = strike > 0 ? Math.floor(cash / strike) : 0;
  const quantity = Math.floor(rawQty / ROUND_LOT) * ROUND_LOT;
  const guarantee = strike * quantity; // Garantia = capital necessário para a PUT
  const totalPremium = premium * quantity;
  const ir = totalPremium * 0.15;
  const netProfit = totalPremium - ir;
  const rentability = guarantee > 0 ? (netProfit / guarantee) * 100 : 0;
  const exceedsCeiling = ceiling !== null && strike > ceiling;

  return { quantity, guarantee, totalPremium, rentability, exceedsCeiling };
}

export default function CalculadorasPage() {
  const [cashRaw, setCashRaw] = useState('150000');
  const cash = parseBRNumber(cashRaw);
  const [rows, setRows] = useState<CalcRow[]>(INITIAL_ROWS);

  function updateRow(id: number, field: keyof CalcRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function clearRow(id: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...emptyRow(), id } : r)));
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Calculator className="h-4.5 w-4.5 text-accent" />
            Calculadoras
          </h1>
          <p className="text-sm text-muted-foreground">
            Compare várias PUTs lado a lado. Digite valores com vírgula (ex: ,80 ou 0,80).
          </p>
        </div>
        <Button size="sm" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar operação
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Caixa disponível</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-1">
            <Label>Caixa (R$)</Label>
            <Input value={cashRaw} onChange={(e) => setCashRaw(e.target.value)} className="font-tabular" placeholder="0,00" />
            <p className="text-[11px] text-faint-foreground">Usado para calcular a quantidade e a garantia de todas as linhas abaixo.</p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface p-3">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="text-left">
              <Th width={90}>Ativo</Th>
              <Th width={110}>
                Cotação
                <span className="mt-0.5 block text-[9px] font-normal text-faint-foreground">
                  <a
                    href="https://www.google.com/finance"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-accent hover:underline"
                  >
                    Google Finance <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </span>
              </Th>
              <Th width={100}>Caixa</Th>
              <Th width={100}>Strike</Th>
              <Th width={100}>Preço Teto</Th>
              <Th width={100}>Qnt Opções</Th>
              <Th width={90}>Prêmio</Th>
              <Th width={110}>Total Prêmio</Th>
              <Th width={90}>Rentab.</Th>
              <Th width={120}>Garantia</Th>
              <Th width={64}></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const r = calcRow(row, cash);
              return (
                <tr key={row.id} className="border-t border-border">
                  <Td>
                    <Input
                      value={row.ticker}
                      onChange={(e) => updateRow(row.id, 'ticker', e.target.value.toUpperCase())}
                      placeholder="PETR4"
                      className="font-tabular h-8 text-xs"
                    />
                  </Td>
                  <Td>
                    <Input
                      value={row.quote}
                      onChange={(e) => updateRow(row.id, 'quote', e.target.value)}
                      placeholder="0,00"
                      className="font-tabular h-8 text-xs"
                    />
                  </Td>
                  <Td>
                    <span className="font-tabular text-xs text-muted-foreground">{formatBRL(cash)}</span>
                  </Td>
                  <Td>
                    <Input
                      value={row.strike}
                      onChange={(e) => updateRow(row.id, 'strike', e.target.value)}
                      placeholder="0,00"
                      className={cn(
                        'font-tabular h-8 text-xs',
                        r.exceedsCeiling && 'border-danger/60 bg-danger-muted text-danger focus-visible:ring-danger/50'
                      )}
                    />
                  </Td>
                  <Td>
                    <Input
                      value={row.ceiling}
                      onChange={(e) => updateRow(row.id, 'ceiling', e.target.value)}
                      placeholder="—"
                      className="font-tabular h-8 text-xs"
                    />
                  </Td>
                  <Td>
                    <span className="font-tabular text-xs font-bold text-accent">{r.quantity.toLocaleString('pt-BR')}</span>
                  </Td>
                  <Td>
                    <Input
                      value={row.premium}
                      onChange={(e) => updateRow(row.id, 'premium', e.target.value)}
                      placeholder="0,00"
                      className="font-tabular h-8 text-xs"
                    />
                  </Td>
                  <Td>
                    <span className="font-tabular text-xs text-accent">{formatBRL(r.totalPremium)}</span>
                  </Td>
                  <Td>
                    <span className="font-tabular text-xs text-foreground">{formatPct(r.rentability, 2)}</span>
                  </Td>
                  <Td>
                    <span className="font-tabular text-xs text-foreground">{formatBRL(r.guarantee)}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => clearRow(row.id)}
                        title="Limpar linha"
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                      <button
                        onClick={() => removeRow(row.id)}
                        title="Remover linha"
                        className="text-faint-foreground hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-faint-foreground">
        O campo Strike fica vermelho quando ultrapassa o Preço Teto daquele ativo — é só um alerta visual, você ainda
        pode confirmar a operação normalmente.
      </p>
    </div>
  );
}

function Th({ children, width }: { children?: React.ReactNode; width?: number }) {
  return (
    <th className="whitespace-nowrap px-2 pb-2 text-[10.5px] font-semibold text-faint-foreground" style={{ width }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1 align-middle">{children}</td>;
}
