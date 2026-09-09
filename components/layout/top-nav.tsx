'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Layers, Calculator, Settings, TrendingUp, Target, User, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketStatusBadge } from '@/components/shared/market-status-badge';
import { getActiveSystem, setActiveSystem, type SystemProfile } from '@/lib/supabase/client';
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/operacoes', label: 'Operações', icon: Layers },
  { href: '/objetivos', label: 'Objetivos', icon: Target },
  { href: '/calculadoras', label: 'Calculadoras', icon: Calculator },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function TopNav() {
  const pathname = usePathname();
  const [system] = useState<SystemProfile>(() => (typeof window !== 'undefined' ? getActiveSystem() : 'diogo'));
  const isMae = system === 'mae';
  const isPremios = pathname?.startsWith('/premios');

  function goToSystem(sys: SystemProfile) {
    setActiveSystem(sys);
    window.location.href = '/dashboard';
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-glass-border bg-glass px-4 py-2.5 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary-accent/15">
            <TrendingUp className="h-3 w-3 text-primary-accent" strokeWidth={2.5} />
          </div>
          <span className="text-xs font-semibold tracking-tight">OptionOS</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToSystem('diogo')}
            title="Diogo"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full',
              !isPremios && !isMae ? 'bg-accent/15 text-accent' : 'text-faint-foreground'
            )}
          >
            <User className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => goToSystem('mae')}
            title="Mãe"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full',
              !isPremios && isMae ? 'bg-info/15 text-info' : 'text-faint-foreground'
            )}
          >
            <Users className="h-3.5 w-3.5" />
          </button>
          <Link
            href="/premios"
            title="Prêmios"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full',
              isPremios ? 'bg-warning-muted text-warning' : 'text-faint-foreground'
            )}
          >
            <Wallet className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-40 hidden border-b border-glass-border bg-glass backdrop-blur-xl md:block">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-accent/15">
              <TrendingUp className="h-3.5 w-3.5 text-primary-accent" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight">OptionOS</span>
            <div className="ml-2 flex items-center gap-1">
              <button
                onClick={() => goToSystem('diogo')}
                title="Ir para o Diogo"
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
                  !isPremios && !isMae ? 'bg-accent/15 text-accent' : 'text-faint-foreground hover:bg-surface-hover hover:text-foreground'
                )}
              >
                <User className="h-2.5 w-2.5" />
                Diogo
              </button>
              <button
                onClick={() => goToSystem('mae')}
                title="Ir para a Mãe"
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
                  !isPremios && isMae ? 'bg-info/15 text-info' : 'text-faint-foreground hover:bg-surface-hover hover:text-foreground'
                )}
              >
                <Users className="h-2.5 w-2.5" />
                Mãe
              </button>
              <Link
                href="/premios"
                title="Ver Prêmios combinados"
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
                  isPremios ? 'bg-warning-muted text-warning' : 'text-faint-foreground hover:bg-surface-hover hover:text-foreground'
                )}
              >
                <Wallet className="h-2.5 w-2.5" />
                Prêmios
              </Link>
            </div>
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
                      active ? 'bg-primary-accent/15 text-primary-accent' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
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
    </>
  );
}
