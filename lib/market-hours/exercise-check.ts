import type { Operation } from '@/lib/types/database';

/**
 * Encontra operações abertas cujo vencimento já passou (uma sexta-
 * feira anterior a hoje) e ainda não têm "Exercido?" classificado —
 * candidatas a verificação automática. Não marca nada sozinho: só
 * identifica quais precisam de uma cotação buscada para decidir.
 */
export function findOperationsNeedingExerciseCheck(operations: Operation[]): Operation[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return operations.filter((op) => {
    if (op.status !== 'aberta') return false;
    if (op.exercised_label) return false; // já classificado manualmente ou antes
    const expiration = new Date(op.expiration + 'T00:00:00');
    return expiration < today;
  });
}

/**
 * Decide se uma operação vencida deveria ser marcada como "Exercido =
 * Sim", comparando a cotação de fechamento buscada com o strike — só
 * se realmente estiver ITM (dentro do dinheiro). Nunca marca "Não"
 * automaticamente: se não estiver ITM, o usuário decide manualmente
 * (pode ter sido recomprada antes, rolada, etc — o sistema não sabe).
 */
export function shouldMarkAsExercised(op: Operation, closingQuote: number): boolean {
  return op.option_type === 'PUT' ? closingQuote < op.strike : closingQuote > op.strike;
}
