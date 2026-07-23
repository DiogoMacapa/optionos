'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatBRL, formatDate } from '@/lib/utils';

interface DataPoint {
  date: string;
  value: number;
}

interface LineChartCardProps {
  title: string;
  data: DataPoint[];
  color?: string;
  valueFormatter?: (v: number) => string;
  emptyLabel?: string;
}

export function LineChartCard({
  title,
  data,
  color = 'var(--accent)',
  valueFormatter = formatBRL,
  emptyLabel = 'Sem dados suficientes ainda.',
}: LineChartCardProps) {
  const gradientId = `line-gradient-${title.replace(/\s+/g, '-')}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-faint-foreground">
            {emptyLabel}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
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
                tickFormatter={(v) => valueFormatter(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatDate(v as string)}
                formatter={(v) => [valueFormatter(Number(v)), '']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
