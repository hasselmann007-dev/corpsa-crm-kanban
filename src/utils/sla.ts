export const SLA_THRESHOLD_MS = 120 * 60 * 1000; // 120 minutes / 2 hours

/**
 * Fallback parser for date strings when new Date(dateStr) returns NaN.
 * Supports ISO strings missing 'T' (e.g. 'YYYY-MM-DD HH:mm:ss') and Brazilian date formats (e.g. 'DD/MM/YYYY HH:mm:ss').
 */
function parseDateFallback(dateStr: string): number {
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
 * 
 * Rules (R1):
 * - If dataHoraEntrada is missing/invalid, returns false.
 * - If etapa === 'Conclusao' (case & accent insensitive), SLA tracking is frozen/stopped and returns false.
 * - If elapsed time since dataHoraEntrada is strictly greater than 120 minutes, returns true.
 */
export function isLeadSLAOverdue(
  dataHoraEntrada?: string | null,
  etapa?: string,
  now: Date = new Date()
): boolean {
  const normalizedStage = (etapa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!dataHoraEntrada || normalizedStage === 'conclusao') {
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

/**
 * Checks whether a Pendência (Sticky Note) item has exceeded the 2-hour (120 minutes) SLA threshold.
 * 
 * Rules (R2):
 * - If completed === true, returns false.
 * - If createdAt is missing/invalid, returns false.
 * - If elapsed time since createdAt is strictly greater than 120 minutes, returns true.
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
