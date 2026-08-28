'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Layers, Calculator, Settings, TrendingUp, Target, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketStatusBadge } from '@/components/shared/market-status-badge';
import { getActiveSystem, type SystemProfile } from '@/lib/supabase/client';
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
 *
 * Cor do item ativo muda conforme o sistema (Diogo = verde/accent,
 * Mãe = azul/info) — reforça visualmente qual dos dois sistemas
 * independentes está aberto no momento.
 */
export function TopNav() {
  const pathname = usePathname();
  // Lazy initializer, mesmo padrão já usado em outros componentes SSR-safe
  // (MarketStatusBadge, DatePickerField) — evita hydration mismatch.
  const [system] = useState<SystemProfile>(() => (typeof window !== 'undefined' ? getActiveSystem() : 'diogo'));
  const isMae = system === 'mae';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 hidden border-b backdrop-blur md:block',
        isMae ? 'border-info/25 bg-info/5' : 'border-border bg-surface/70'
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', isMae ? 'bg-info/15' : 'bg-accent/15')}>
            <TrendingUp className={cn('h-3.5 w-3.5', isMae ? 'text-info' : 'text-accent')} strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight">OptionOS</span>
          <Link
            href="/escolher-sistema"
            title="Trocar de sistema"
            className={cn(
              'ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-opacity hover:opacity-70',
              isMae ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent'
            )}
          >
            {isMae ? <Users className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {isMae ? 'Mãe' : 'Diogo'}
          </Link>
        </div>

        <nav className="flex items-center gap-3">
          <MarketStatusBadge />
          <div className="flex items-center gap-1">
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
                      ? isMae
                        ? 'bg-info/15 text-info'
                        : 'bg-accent-muted text-accent'
                      : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
