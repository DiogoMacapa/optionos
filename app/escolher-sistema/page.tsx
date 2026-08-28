'use client';

import { TrendingUp, User, Users } from 'lucide-react';
import { setActiveSystem, type SystemProfile } from '@/lib/supabase/client';

/**
 * Tela de escolha entre os dois sistemas independentes (Diogo e Mãe) —
 * cada um com dados isolados em schemas separados dentro do mesmo
 * projeto Supabase. Só aparece antes de o usuário escolher; depois a
 * escolha fica salva no navegador (localStorage), sem precisar
 * escolher de novo a cada visita.
 */
export default function EscolherSistemaPage() {

  function choose(system: SystemProfile) {
    setActiveSystem(system);
    // Recarrega a página inteira (não navegação client-side) — garante que
    // o cliente Supabase correto seja usado em toda consulta a partir daqui,
    // já que a instância ativa é decidida uma vez, no carregamento do módulo.
    window.location.href = '/dashboard';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15">
          <TrendingUp className="h-4 w-4 text-accent" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-semibold tracking-tight">OptionOS</span>
      </div>

      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Qual sistema você quer abrir?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cada um tem seus próprios dados, totalmente separados.</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => choose('diogo')}
          className="flex flex-col items-center gap-3 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-muted via-accent-muted/40 to-surface px-6 py-8 transition-transform hover:scale-[1.02]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
            <User className="h-6 w-6 text-accent" />
          </div>
          <span className="text-base font-semibold text-foreground">Diogo</span>
        </button>

        <button
          onClick={() => choose('mae')}
          className="flex flex-col items-center gap-3 rounded-2xl border border-info/25 bg-gradient-to-br from-info/15 via-info/5 to-surface px-6 py-8 transition-transform hover:scale-[1.02]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info/15">
            <Users className="h-6 w-6 text-info" />
          </div>
          <span className="text-base font-semibold text-foreground">Mãe</span>
        </button>
      </div>
    </div>
  );
}
