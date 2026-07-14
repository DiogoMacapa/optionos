import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata número como moeda BRL. */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata número como percentual (já assume valor em %, ex: 5.48 -> "5,48%"). */
export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

/** Formata número decimal genérico (ex: delta, strike). */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Converte texto em número, tolerando formatos variados que o usuário
 * pode digitar ou colar: "1234.56", "1234,56", "1.234,56", "R$ 1.234,56".
 *
 * Regra: remove tudo que não for dígito, vírgula ou ponto. Se sobrar
 * tanto vírgula quanto ponto, assume formato BR (ponto = milhar,
 * vírgula = decimal). Se sobrar só um dos dois, trata como separador
 * decimal.
 */
export function parseBRNumber(input: string): number {
  const cleaned = input.replace(/[^\d.,]/g, '');
  if (cleaned === '') return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    // Formato BR completo: 1.234,56 → remove pontos (milhar), troca vírgula por ponto
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Só vírgula: é o separador decimal
    normalized = cleaned.replace(',', '.');
  } else {
    // Só ponto ou só dígitos: já está em formato aceito pelo Number()
    normalized = cleaned;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}


export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('pt-BR');
}
