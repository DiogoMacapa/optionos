'use client';

import { useState, useEffect, useRef } from 'react';
import { Calculator, Plus, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, formatBRL, formatPct, parseBRNumber } from '@/lib/utils';

const ROUND_LOT = 100;
const STORAGE_KEY_ROWS = 'optionos:calculadoras:rows';
const STORAGE_KEY_CASH = 'optionos:calculadoras:cash';

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

  // Taxa: igual à fórmula original da planilha do usuário (=Total Prêmio / Caixa) —
  // mede o retorno sobre o caixa TOTAL disponível, bruto (sem descontar IR).
  const taxaSobreCaixa = cash > 0 ? (totalPremium / cash) * 100 : 0;

  // Rentabilidade líquida: lucro já líquido de IR, sobre a garantia DESTA operação
  // específica (não o caixa total) — mede o retorno daquela operação isoladamente.
  const rentabLiquida = guarantee > 0 ? (netProfit / guarantee) * 100 : 0;

  const exceedsCeiling = ceiling !== null && strike > ceiling;

  return { quantity, guarantee, totalPremium, taxaSobreCaixa, rentabLiquida, exceedsCeiling };
}

function loadInitialRows(): CalcRow[] {
  if (typeof window === 'undefined') return INITIAL_ROWS;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY_ROWS);
    if (!saved) return INITIAL_ROWS;
    const parsed = JSON.parse(saved) as CalcRow[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ROWS;
  } catch {
    return INITIAL_ROWS;
  }
}

function loadInitialCash(): string {
  if (typeof window === 'undefined') return '150000';
  try {
    return window.localStorage.getItem(STORAGE_KEY_CASH) ?? '150000';
  } catch {
    return '150000';
  }
}

export default function CalculadorasPage() {
  const [cashRaw, setCashRaw] = useState(loadInitialCash);
  const cash = parseBRNumber(cashRaw);
  const [rows, setRows] = useState<CalcRow[]>(loadInitialRows);
  const [quoteStatus, setQuoteStatus] = useState<Record<number, 'loading' | 'error' | null>>({});
  const [quoteError, setQuoteError] = useState<Record<number, string>>({});

  // Persiste a cada mudança de linhas/caixa.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(rows));
    } catch {
      // Ignora falha de persistência (ex: modo privado sem quota).
    }
  }, [rows]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_CASH, cashRaw);
    } catch {
      // Ignora falha de persistência.
    }
  }, [cashRaw]);

  function updateRow(id: number, field: keyof CalcRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function clearRow(id: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...emptyRow(), id } : r)));
    setQuoteStatus((s) => ({ ...s, [id]: null }));
    setQuoteError((e) => ({ ...e, [id]: '' }));
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  async function fetchQuote(id: number, ticker: string) {
    const t = ticker.trim();
    if (!t) return;
    setQuoteStatus((s) => ({ ...s, [id]: 'loading' }));
    setQuoteError((e) => ({ ...e, [id]: '' }));
    try {
      const res = await fetch(`/api/quote?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) {
        setQuoteStatus((s) => ({ ...s, [id]: 'error' }));
        setQuoteError((e) => ({ ...e, [id]: data.error ?? 'Erro ao buscar cotação.' }));
        return;
      }
      updateRow(id, 'quote', String(data.price).replace('.', ','));
      setQuoteStatus((s) => ({ ...s, [id]: null }));
    } catch {
      setQuoteStatus((s) => ({ ...s, [id]: 'error' }));
      setQuoteError((e) => ({ ...e, [id]: 'Falha de conexão ao buscar cotação.' }));
    }
  }

  // Busca automática: dispara sozinha ~700ms depois que o usuário para de
  // digitar o ticker, sem precisar clicar no botão de atualizar.
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastAutoFetchedTicker = useRef<Record<number, string>>({});

  useEffect(() => {
    for (const row of rows) {
      const t = row.ticker.trim().toUpperCase();
      if (debounceTimers.current[row.id]) clearTimeout(debounceTimers.current[row.id]);
      if (!t) {
        lastAutoFetchedTicker.current[row.id] = '';
        continue;
      }
      if (lastAutoFetchedTicker.current[row.id] === t) continue;
      debounceTimers.current[row.id] = setTimeout(() => {
        lastAutoFetchedTicker.current[row.id] = t;
        fetchQuote(row.id, t);
      }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.ticker).join('|')]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Calculator className="h-4.5 w-4.5 text-accent" />
            Calculadoras
          </h1>
          <p className="text-sm text-muted-foreground">
            Compare várias PUTs lado a lado. Digite valores com vírgula (ex: ,80 ou 0,80). A cotação é buscada
            automaticamente ao digitar o ativo.
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
              <Th width={130}>Cotação</Th>
              <Th width={100}>Caixa</Th>
              <Th width={100}>Strike</Th>
              <Th width={100}>Preço Teto</Th>
              <Th width={100}>Qnt Opções</Th>
              <Th width={90}>Prêmio</Th>
              <Th width={110}>Total Prêmio</Th>
              <Th width={80}>Taxa</Th>
              <Th width={90}>Rentab. líq.</Th>
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
                    <div className="flex items-center gap-1">
                      <Input
                        value={row.quote}
                        onChange={(e) => updateRow(row.id, 'quote', e.target.value)}
                        placeholder="0,00"
                        className="font-tabular h-8 text-xs"
                      />
                      <button
                        onClick={() => fetchQuote(row.id, row.ticker)}
                        disabled={!row.ticker.trim() || quoteStatus[row.id] === 'loading'}
                        title="Atualizar cotação agora (também busca automaticamente ao digitar o ativo)"
                        className="shrink-0 text-faint-foreground hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', quoteStatus[row.id] === 'loading' && 'animate-spin')} />
                      </button>
                    </div>
                    {row.ticker.trim() && (
                      <a
                        href={`https://www.google.com/finance/quote/${row.ticker.trim()}:BVMF`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] text-accent hover:underline"
                      >
                        ver {row.ticker.trim()} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {quoteStatus[row.id] === 'error' && (
                      <p className="mt-0.5 text-[9px] text-danger">{quoteError[row.id]}</p>
                    )}
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
                    <span className="font-tabular text-xs text-foreground" title="Total Prêmio ÷ Caixa (igual à sua planilha)">
                      {formatPct(r.taxaSobreCaixa, 2)}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="font-tabular text-xs text-foreground"
                      title="Lucro líquido (após IR) ÷ Garantia desta operação"
                    >
                      {formatPct(r.rentabLiquida, 2)}
                    </span>
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

      <div className="space-y-1 text-xs text-faint-foreground">
        <p>
          O campo Strike fica vermelho quando ultrapassa o Preço Teto daquele ativo — é só um alerta visual, você
          ainda pode confirmar a operação normalmente.
        </p>
        <p>
          <strong className="text-muted-foreground">Taxa</strong> = Total Prêmio ÷ Caixa (retorno bruto sobre o caixa
          total disponível, igual à sua planilha) · <strong className="text-muted-foreground">Rentab. líq.</strong> =
          Lucro líquido após IR ÷ Garantia desta operação (retorno sobre o capital que ela mesma consome).
        </p>
      </div>
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
