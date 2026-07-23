import { TopNav } from '@/components/layout/top-nav';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="pb-20 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
