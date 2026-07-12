'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatBRL } from '@/lib/utils';

interface BarDatum {
  label: string;
  value: number;
}

interface BarChartCardProps {
  title: string;
  data: BarDatum[];
  layout?: 'horizontal' | 'vertical';
  valueFormatter?: (v: number) => string;
  emptyLabel?: string;
  colorFn?: (value: number) => string;
}

export function BarChartCard({
  title,
  data,
  layout = 'horizontal',
  valueFormatter = formatBRL,
  emptyLabel = 'Sem dados ainda.',
  colorFn,
}: BarChartCardProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-faint-foreground">
            {emptyLabel}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={layout === 'vertical' ? 'vertical' : 'horizontal'}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={layout === 'vertical'} horizontal={layout === 'horizontal'} />
              {layout === 'vertical' ? (
                <>
                  <XAxis type="number" stroke="var(--faint-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={valueFormatter} />
                  <YAxis type="category" dataKey="label" stroke="var(--faint-foreground)" fontSize={11} tickLine={false} axisLine={false} width={64} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" stroke="var(--faint-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--faint-foreground)" fontSize={11} tickLine={false} axisLine={false} width={56} tickFormatter={valueFormatter} />
                </>
              )}
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [valueFormatter(Number(v)), '']}
                cursor={{ fill: 'var(--surface-hover)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={colorFn ? colorFn(d.value) : 'var(--accent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
