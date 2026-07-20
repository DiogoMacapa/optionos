'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Layers, Calculator, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Painel', icon: LayoutGrid },
  { href: '/operacoes', label: 'Operações', icon: Layers },
  { href: '/calculadoras', label: 'Calc.', icon: Calculator },
  { href: '/configuracoes', label: 'Config.', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-accent' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
