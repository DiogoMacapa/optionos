'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { parseBRNumber } from '@/lib/utils';
import type { ParsedOptionRow } from '@/lib/ocr/book-parser';

export interface EditableBookRow extends ParsedOptionRow {
  optionType: 'PUT' | 'CALL';
  expiration: string; // YYYY-MM-DD
}

interface BookConfirmTableProps {
  rows: ParsedOptionRow[];
  onConfirm: (rows: EditableBookRow[]) => void;
  onCancel: () => void;
}

const COLS: { key: keyof ParsedOptionRow; label: string }[] = [
  { key: 'strike', label: 'Strike' },
  { key: 'delta', label: 'Delta' },
  { key: 'premium', label: 'Prêmio' },
  { key: 'bid', label: 'Bid' },
  { key: 'ask', label: 'Ask' },
  { key: 'volume', label: 'Vol.' },
  { key: 'openInterest', label: 'OI' },
];

export function BookConfirmTable({ rows, onConfirm, onCancel }: BookConfirmTableProps) {
  const [editable, setEditable] = useState<EditableBookRow[]>(() =>
    rows.map((r) => ({ ...r, optionType: 'PUT', expiration: '' }))
  );
  const [expiration, setExpiration] = useState('');

  const updateCell = (idx: number, key: keyof ParsedOptionRow, value: string) => {
    setEditable((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const numeric = key === 'strike' || key === 'delta' || key === 'premium' || key === 'bid' || key === 'ask' || key === 'volume' || key === 'openInterest';
        return { ...row, [key]: numeric ? (value === '' ? null : parseBRNumber(value)) : value };
      })
    );
  };

  const removeRow = (idx: number) => {
    setEditable((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyExpirationToAll = () => {
    if (!expiration) return;
    setEditable((prev) => prev.map((r) => ({ ...r, expiration })));
  };

  const lowConfidenceCount = editable.filter((r) => r.confidence !== 'alta').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-muted px-3 py-2.5 text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          O layout do book ainda não foi validado com um print real do BTG — revise linha a linha com atenção
          antes de salvar. Remova qualquer linha que o OCR tenha lido errado.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Vencimento (aplicar a todas)</label>
          <Input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} className="font-tabular" />
        </div>
        <Button variant="secondary" size="sm" onClick={applyExpirationToAll}>
          Aplicar a todas as linhas
        </Button>
        <div className="ml-auto">
          <Badge variant={lowConfidenceCount > 0 ? 'warning' : 'success'}>
            {lowConfidenceCount === 0 ? 'Todas com confiança alta' : `${lowConfidenceCount} linha(s) para revisar`}
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated text-xs text-muted-foreground">
              <th className="w-16 px-2 py-2 text-left">Tipo</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left">{c.label}</th>
              ))}
              <th className="w-24 px-2 py-2 text-left">Venc.</th>
              <th className="w-16 px-2 py-2 text-left">Conf.</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {editable.map((row, idx) => (
              <tr key={idx} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-1.5">
                  <Select value={row.optionType} onValueChange={(v) => setEditable((prev) => prev.map((r, i) => (i === idx ? { ...r, optionType: v as 'PUT' | 'CALL' } : r)))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="CALL">CALL</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    <Input
                      value={row[c.key] ?? ''}
                      onChange={(e) => updateCell(idx, c.key, e.target.value)}
                      className="h-8 font-tabular text-xs"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <Input
                    type="date"
                    value={row.expiration}
                    onChange={(e) => setEditable((prev) => prev.map((r, i) => (i === idx ? { ...r, expiration: e.target.value } : r)))}
                    className="h-8 font-tabular text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Badge variant={row.confidence === 'alta' ? 'success' : row.confidence === 'media' ? 'warning' : 'danger'}>
                    {row.confidence}
                  </Badge>
                </td>
                <td className="px-2 py-1.5">
                  <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
            {editable.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 3} className="px-2 py-6 text-center text-sm text-faint-foreground">
                  Nenhuma linha reconhecida. Tente um print com melhor resolução ou preencha manualmente em Oportunidades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          disabled={editable.length === 0 || !editable.every((r) => r.expiration && r.strike !== null && r.premium !== null)}
          onClick={() => onConfirm(editable)}
        >
          Salvar {editable.length} linha{editable.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
