import { getClientFor, type SystemProfile } from '@/lib/supabase/client';
import type { Operation } from '@/lib/types/database';

export async function listOperationsForSystem(system: SystemProfile): Promise<Operation[]> {
  const client = getClientFor(system);
  const { data, error } = await client
    .from('operations')
    .select('*, asset:assets(*)')
    .order('expiration', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Operation[];
}

/**
 * Marca/desmarca o saque desta operação da Mãe — dá baixa nos DOIS campos
 * de uma vez (comissão E prêmio), já que na prática o usuário saca os dois
 * juntos. Assim, sacar aqui em /premios também reflete na aba Prêmios de
 * dentro do sistema Mãe, e vice-versa (a aba Prêmios já faz o mesmo, ver
 * premiums-tab.tsx).
 */
export async function setCommissionWithdrawn(operationId: string, withdrawn: boolean): Promise<void> {
  const client = getClientFor('mae');
  const nextValue = withdrawn ? new Date().toISOString() : null;
  const { error } = await client
    .from('operations')
    .update({ commission_withdrawn_at: nextValue, premium_withdrawn_at: nextValue })
    .eq('id', operationId);
  if (error) throw error;
}
