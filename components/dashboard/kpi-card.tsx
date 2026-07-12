import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean } | null;
  accent?: 'default' | 'accent' | 'danger';
}

export function KpiCard({ label, value, icon: Icon, trend, accent = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            'h-3.5 w-3.5',
            accent === 'accent' ? 'text-accent' : accent === 'danger' ? 'text-danger' : 'text-faint-foreground'
          )}
        />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-tabular text-xl font-semibold text-foreground">{value}</span>
        {trend && (
          <span className={cn('font-tabular text-xs font-medium', trend.positive ? 'text-accent' : 'text-danger')}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
