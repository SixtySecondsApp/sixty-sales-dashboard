import type { TemporalContextPayload } from '@/components/copilot/types';

const DEFAULT_LOCALE = undefined;

export function getTemporalContext(): TemporalContextPayload {
  const now = new Date();
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const localeString = now.toLocaleString(DEFAULT_LOCALE, { timeZone: timezone });
  const date = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(now);

  return {
    isoString: now.toISOString(),
    localeString,
    date,
    time,
    timezone,
    offsetMinutes: -now.getTimezoneOffset()
  };
}























