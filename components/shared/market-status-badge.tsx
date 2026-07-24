'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { computeMarketStatus, type MarketStatus } from '@/lib/market-hours/status';

/**
 * Indicador compacto de horário de funcionamento da B3 (bolinha
 * verde/vermelha piscando + rótulo + contagem regressiva). Atualiza
 * sozinho a cada minuto, sem precisar de nenhuma API — é só cálculo
 * de horário local (fuso de Brasília).
 */
export function MarketStatusBadge() {
  // Lazy initializer: no servidor (SSR) window não existe, então começa
  // null; no navegador, já calcula de cara — mesmo padrão já usado em
  // DatePickerField para evitar hydration mismatch sem precisar de um
  // setState síncrono dentro de useEffect.
  const [status, setStatus] = useState<MarketStatus | null>(() => (typeof window !== 'undefined' ? computeMarketStatus() : null));

  useEffect(() => {
    const interval = setInterval(() => setStatus(computeMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        status.isOpen ? 'border-accent/25 bg-accent-muted text-accent' : 'border-border bg-surface-elevated text-muted-foreground'
      )}
    >
      <span className="relative flex h-2 w-2">
        {status.isOpen && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', status.isOpen ? 'bg-accent' : 'bg-faint-foreground')} />
      </span>
      <span className="font-semibold">B3 {status.label}</span>
      <span className="text-faint-foreground">·</span>
      <span className="font-tabular text-[11px]">{status.nextChangeLabel}</span>
    </div>
  );
}
