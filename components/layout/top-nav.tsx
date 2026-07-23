'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Layers, Calculator, Settings, TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/operacoes', label: 'Operações', icon: Layers },
  { href: '/objetivos', label: 'Objetivos', icon: Target },
  { href: '/calculadoras', label: 'Calculadoras', icon: Calculator },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

/**
 * Navegação horizontal para telas grandes (desktop/notebook) — troca
 * a sidebar fixa lateral por uma barra no topo, liberando a largura
 * inteira da tela para os cards e gráficos. Só visível a partir de
 * md: (celular continua usando MobileNav, barra inferior).
 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-surface/70 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15">
            <TrendingUp className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight">OptionOS</span>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent-muted text-accent'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
