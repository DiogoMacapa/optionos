import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha explícita em vez de silenciosa — evita debug longo depois.
  console.error(
    'OptionOS: variáveis NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.'
  );
}

export type SystemProfile = 'diogo' | 'mae';

const STORAGE_KEY = 'optionos-active-system';

/**
 * Dois sistemas independentes (Diogo e Mãe), cada um com suas próprias
 * tabelas isoladas em um schema Postgres separado dentro do MESMO
 * projeto Supabase — evita o custo de um segundo projeto (usuário já
 * tem 2 projetos ativos, limite do plano gratuito) mantendo isolamento
 * real de dados: nenhuma tabela do schema "diogo" é visível para uma
 * consulta feita no schema "mae", e vice-versa.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const diogoClient: any = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  db: { schema: 'diogo' },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const maeClient: any = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  db: { schema: 'mae' },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clients: Record<SystemProfile, any> = {
  diogo: diogoClient,
  mae: maeClient,
};

/** Lê o sistema ativo salvo no navegador. Sem escolha ainda (ou fora do navegador, ex: SSR) -> 'diogo' (padrão). */
export function getActiveSystem(): SystemProfile {
  if (typeof window === 'undefined') return 'diogo';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'mae' ? 'mae' : 'diogo';
}

export function setActiveSystem(system: SystemProfile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, system);
}

/**
 * Cliente Supabase do sistema atualmente ativo. Todo o resto do
 * código (lib/supabase/queries.ts) continua importando `supabase`
 * normalmente — a troca de schema acontece de forma transparente,
 * sem precisar mudar nenhuma query existente.
 */
export const supabase = clients[getActiveSystem()];

/** Cliente de um sistema específico — usado só na tela de escolha inicial. */
export function getClientFor(system: SystemProfile) {
  return clients[system];
}
