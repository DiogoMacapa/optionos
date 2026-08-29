'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/layout/top-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { getActiveSystem } from '@/lib/supabase/client';

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked] = useState(() => typeof window !== 'undefined' && !!window.localStorage.getItem('optionos-active-system'));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasChosen = window.localStorage.getItem('optionos-active-system');
    if (!hasChosen) {
      router.replace('/escolher-sistema');
    }
  }, [router]);

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background" data-system={getActiveSystem()}>
      <TopNav />
      <main className="pb-20 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
