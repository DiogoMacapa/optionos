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

/** Marca/desmarca a comissão desta operação (só faz sentido em operações da Mãe) como sacada. */
export async function setCommissionWithdrawn(operationId: string, withdrawn: boolean): Promise<void> {
  const client = getClientFor('mae');
  const { error } = await client
    .from('operations')
    .update({ commission_withdrawn_at: withdrawn ? new Date().toISOString() : null })
    .eq('id', operationId);
  if (error) throw error;
}
