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

export interface CommissionWithdrawal {
  id: string;
  period_key: string;
  withdrawn_at: string;
}

export async function listCommissionWithdrawals(): Promise<CommissionWithdrawal[]> {
  const client = getClientFor('mae');
  const { data, error } = await client.from('commission_withdrawals').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function markCommissionWithdrawn(periodKey: string): Promise<void> {
  const client = getClientFor('mae');
  const { error } = await client.from('commission_withdrawals').upsert({ period_key: periodKey }, { onConflict: 'period_key' });
  if (error) throw error;
}

export async function unmarkCommissionWithdrawn(periodKey: string): Promise<void> {
  const client = getClientFor('mae');
  const { error } = await client.from('commission_withdrawals').delete().eq('period_key', periodKey);
  if (error) throw error;
}
