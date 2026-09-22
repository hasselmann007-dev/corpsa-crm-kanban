export const SLA_THRESHOLD_MS = 120 * 60 * 1000; // 120 minutes / 2 hours

/**
 * Fallback parser for date strings when new Date(dateStr) returns NaN.
 * Supports ISO strings missing 'T' (e.g. 'YYYY-MM-DD HH:mm:ss') and Brazilian date formats (e.g. 'DD/MM/YYYY HH:mm:ss').
 */
export function parseDateFallback(dateStr: string): number {
  if (!dateStr || typeof dateStr !== 'string') return NaN;
  const trimmed = dateStr.trim();
  if (!trimmed) return NaN;

  // Try replacing space with T for unzoned ISO strings
  let time = new Date(trimmed.replace(' ', 'T')).getTime();
  if (!isNaN(time)) return time;

  // Try Brazilian format: DD/MM/YYYY or DD/MM/YYYY HH:mm:ss (also allowing '-' or '.')
  const brMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    const year = parseInt(brMatch[3], 10);
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const minute = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const second = brMatch[6] ? parseInt(brMatch[6], 10) : 0;

    const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
    if (!isNaN(utcDate.getTime())) {
      return utcDate.getTime();
    }
  }

  return NaN;
}

/**
 * Checks whether a Lead card has exceeded the 2-hour (120 minutes) SLA threshold.
 */
export function isLeadSLAOverdue(
  dataHoraEntrada?: string | null,
  etapa?: string,
  now: Date = new Date()
): boolean {
  if (!dataHoraEntrada || !etapa) {
    return false;
  }

  const normalizedStage = (etapa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!normalizedStage.includes('roleta')) {
    return false;
  }

  let entryTime = new Date(dataHoraEntrada).getTime();
  if (isNaN(entryTime)) {
    entryTime = parseDateFallback(dataHoraEntrada);
  }
  if (isNaN(entryTime)) {
    return false;
  }

  const elapsedMs = now.getTime() - entryTime;
  return elapsedMs > SLA_THRESHOLD_MS;
}

export interface SlaCountdownInfo {
  isOverdue: boolean;
  isCountingDown: boolean;
  minutesRemaining: number;
  label: string;
}

/**
 * Contagem regressiva de SLA para a Roleta:
 * Inicia contagem regressiva de 30 minutos quando a pasta atinge 1h30 na Roleta
 * (faltando 30 min para estourar o prazo padrão de 2h).
 * Diminui a cada minuto até estourar.
 */
export function getLeadSlaCountdown(
  dataHoraEntrada?: string | null,
  etapa?: string,
  now: Date = new Date()
): SlaCountdownInfo {
  if (!dataHoraEntrada || !etapa) {
    return { isOverdue: false, isCountingDown: false, minutesRemaining: 120, label: '' };
  }

  const normalizedStage = (etapa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!normalizedStage.includes('roleta')) {
    return { isOverdue: false, isCountingDown: false, minutesRemaining: 120, label: '' };
  }

  let entryTime = new Date(dataHoraEntrada).getTime();
  if (isNaN(entryTime)) {
    entryTime = parseDateFallback(dataHoraEntrada);
  }
  if (isNaN(entryTime)) {
    return { isOverdue: false, isCountingDown: false, minutesRemaining: 120, label: '' };
  }

  const elapsedMs = now.getTime() - entryTime;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const remainingMin = 120 - elapsedMin;

  if (remainingMin <= 0) {
    return {
      isOverdue: true,
      isCountingDown: false,
      minutesRemaining: 0,
      label: 'SLA Estourada'
    };
  }

  if (remainingMin <= 30) {
    return {
      isOverdue: false,
      isCountingDown: true,
      minutesRemaining: remainingMin,
      label: `${remainingMin} min p/ estourar SLA`
    };
  }

  return {
    isOverdue: false,
    isCountingDown: false,
    minutesRemaining: remainingMin,
    label: ''
  };
}

/**
 * Checks whether a sticky note (pendência) has exceeded the 2-hour (120 minutes) SLA threshold.
 */
export function isPendenciaSLAOverdue(
  createdAt?: string | null,
  completed: boolean = false,
  now: Date = new Date()
): boolean {
  if (completed || !createdAt) {
    return false;
  }

  let createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) {
    createdTime = parseDateFallback(createdAt);
  }
  if (isNaN(createdTime)) {
    return false;
  }

  const elapsedMs = now.getTime() - createdTime;
  return elapsedMs > SLA_THRESHOLD_MS;
}
