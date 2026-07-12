'use client';

import { Star, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { cn, formatBRL, formatDate, formatNumber } from '@/lib/utils';
import { efficiencyLabel } from '@/lib/scoring/engine';
import { GlossaryTerm } from '@/components/shared/glossary-term';
import type { Opportunity } from '@/lib/types/database';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick?: () => void;
  onOpenOperation?: () => void;
  onAnalyze?: () => void;
}

function barColor(score: number): string {
  if (score >= 85) return 'var(--accent)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
}

export function OpportunityCard({ opportunity, onClick, onOpenOperation, onAnalyze }: OpportunityCardProps) {
  const entry = opportunity.option_chain_entry;
  const asset = opportunity.asset;
  const eff = efficiencyLabel(opportunity.efficiency_pct);
  const color = barColor(opportunity.score);

  return (
    <div
      onClick={onClick}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-hover"
    >
      {/* Barra-termômetro lateral — assinatura visual do sistema */}
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: color }}
      />

      <div className="flex-1 pl-2">
        <div className="flex items-center gap-2">
          <span className="font-tabular text-sm font-semibold text-foreground">{asset?.ticker ?? '—'}</span>
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium',
              entry?.option_type === 'PUT'
                ? 'border-info/25 bg-info/10 text-info'
                : 'border-accent/25 bg-accent-muted text-accent'
            )}
          >
            {entry?.option_type ?? '—'}
          </span>
          <span className="text-xs text-faint-foreground">{formatDate(entry?.expiration)}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-tabular text-xs text-muted-foreground">
          <span onClick={(e) => e.stopPropagation()}>
            <GlossaryTerm termKey="strike">Strike</GlossaryTerm> <span className="text-foreground">{formatNumber(entry?.strike)}</span>
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <GlossaryTerm termKey="delta">Δ</GlossaryTerm> <span className="text-foreground">{formatNumber(entry?.delta, 2)}</span>
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <GlossaryTerm termKey="premio">Prêmio</GlossaryTerm> <span className="text-accent">{formatBRL(entry?.premium)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const filled = i + 1 <= Math.floor(opportunity.stars);
            const half = !filled && i + 0.5 <= opportunity.stars;
            return (
              <Star
                key={i}
                className={cn('h-3 w-3', filled || half ? 'fill-current' : 'fill-none')}
                style={{ color: filled || half ? color : 'var(--faint-foreground)' }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-tabular text-sm font-semibold" style={{ color }}>
            {formatNumber(opportunity.score, 0)}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: `${color}1a`, color }}
          >
            {eff.label}
          </span>
        </div>
      </div>

      {(onOpenOperation || onAnalyze) && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onAnalyze && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze();
              }}
              title="Analisar com IA"
              className="rounded-md p-1.5 text-faint-foreground hover:bg-surface hover:text-accent"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
          {onOpenOperation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenOperation();
              }}
              title="Abrir operação"
              className="rounded-md p-1.5 text-faint-foreground hover:bg-surface hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <ChevronRight className="h-4 w-4 shrink-0 text-faint-foreground transition-transform group-hover:translate-x-0.5" />
    </div>
  );
}
