'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatBRL, formatDate } from '@/lib/utils';

interface AreaSeriesPoint {
  date: string;
  equity: number;
  cash: number;
}

interface AreaChartCardProps {
  title: string;
  data: AreaSeriesPoint[];
  emptyLabel?: string;
}

export function AreaChartCard({ title, data, emptyLabel = 'Sem dados suficientes ainda.' }: AreaChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-faint-foreground">{emptyLabel}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--info)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--info)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v)}
                stroke="var(--faint-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--faint-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => formatBRL(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatDate(v as string)}
                formatter={(v, name) => [formatBRL(Number(v)), name === 'equity' ? 'Patrimônio' : 'Caixa']}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
                formatter={(value) => (value === 'equity' ? 'Patrimônio' : 'Caixa')}
              />
              <Area type="monotone" dataKey="equity" stroke="var(--accent)" fill="url(#equityFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="cash" stroke="var(--info)" fill="url(#cashFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
