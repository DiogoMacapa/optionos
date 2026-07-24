/**
 * Horário de funcionamento da B3 (horário de Brasília):
 * segunda a sexta, 10h às 17h (pregão regular — simplificado,
 * sem considerar o after-market nem feriados específicos, que
 * mudam ano a ano e precisariam de uma lista atualizada à parte).
 */
const MARKET_OPEN_HOUR = 10;
const MARKET_CLOSE_HOUR = 17;

export interface MarketStatus {
  isOpen: boolean;
  label: string; // "Aberta" | "Fechada"
  nextChangeLabel: string; // "Fecha em 2h 15min" | "Abre em 14h 30min" etc
}

function toBrasiliaTime(date: Date): Date {
  // Usa Intl para converter corretamente considerando horário de verão/fuso,
  // em vez de assumir um offset fixo.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  );
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export function computeMarketStatus(now: Date = new Date()): MarketStatus {
  const brasilia = toBrasiliaTime(now);
  const weekday = brasilia.getDay(); // 0=domingo, 6=sábado
  const isWeekday = weekday >= 1 && weekday <= 5;

  const openTime = new Date(brasilia);
  openTime.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  const closeTime = new Date(brasilia);
  closeTime.setHours(MARKET_CLOSE_HOUR, 0, 0, 0);

  const isOpen = isWeekday && brasilia >= openTime && brasilia < closeTime;

  if (isOpen) {
    return { isOpen: true, label: 'Aberta', nextChangeLabel: `Fecha em ${formatDuration(closeTime.getTime() - brasilia.getTime())}` };
  }

  // Calcula a próxima abertura (pula fins de semana).
  const nextOpen = new Date(brasilia);
  if (isWeekday && brasilia < openTime) {
    nextOpen.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  } else {
    do {
      nextOpen.setDate(nextOpen.getDate() + 1);
    } while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6);
    nextOpen.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  }

  return { isOpen: false, label: 'Fechada', nextChangeLabel: `Abre em ${formatDuration(nextOpen.getTime() - brasilia.getTime())}` };
}
