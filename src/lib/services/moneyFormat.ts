export type MoneyFormatOptions = {
  currencyCode: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  compact?: boolean;
};

function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getDefaultLocaleForCurrency(currencyCode: string): string {
  switch ((currencyCode || '').toUpperCase()) {
    case 'GBP':
      return 'en-GB';
    case 'USD':
      return 'en-US';
    case 'EUR':
      return 'en-IE';
    case 'AUD':
      return 'en-AU';
    case 'CAD':
      return 'en-CA';
    default:
      return 'en-GB';
  }
}

export function formatMoney(amount: number, options: MoneyFormatOptions): string {
  const currencyCode = (options.currencyCode || 'GBP').toUpperCase();
  const locale = options.locale || getDefaultLocaleForCurrency(currencyCode);

  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? 0;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits,
    maximumFractionDigits,
    ...(options.compact
      ? {
          notation: 'compact' as const,
          compactDisplay: 'short' as const,
        }
      : null),
  });

  return formatter.format(safeNumber(amount));
}

export function getCurrencySymbol(currencyCode: string, locale?: string): string {
  try {
    const code = (currencyCode || 'GBP').toUpperCase();
    const fmt = new Intl.NumberFormat(locale || getDefaultLocaleForCurrency(code), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const parts = fmt.formatToParts(0);
    const symbol = parts.find((p) => p.type === 'currency')?.value;
    return symbol || code;
  } catch {
    return currencyCode || 'GBP';
  }
}








