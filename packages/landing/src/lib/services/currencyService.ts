// src/lib/services/currencyService.ts
// Currency detection and conversion service

export type CurrencyCode = 'USD' | 'GBP' | 'EUR' | 'AUD' | 'CAD';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
}

export interface ConversionRates {
  [key: string]: number;
}

// Currency definitions
export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
};

// Conversion rates from USD (updated periodically - in production, use a live API)
const CONVERSION_RATES: ConversionRates = {
  USD: 1.0,
  GBP: 0.79,
  EUR: 0.92,
  AUD: 1.53,
  CAD: 1.36,
};

// Country to currency mapping
const COUNTRY_CURRENCY_MAP: Record<string, CurrencyCode> = {
  // North America
  US: 'USD',
  CA: 'CAD',
  // UK & Ireland
  GB: 'GBP',
  UK: 'GBP',
  IE: 'EUR',
  // Europe (Eurozone)
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  // Oceania
  AU: 'AUD',
  NZ: 'AUD',
};

// Storage key for user's currency preference
const CURRENCY_STORAGE_KEY = 'sixty_preferred_currency';

/**
 * Detect user's currency based on location
 */
export async function detectUserCurrency(): Promise<CurrencyCode> {
  // First check if user has a saved preference
  const savedCurrency = getSavedCurrency();
  if (savedCurrency) {
    return savedCurrency;
  }

  try {
    // Try to detect from timezone first (fastest, no API call)
    const timezoneCurrency = detectFromTimezone();
    if (timezoneCurrency) {
      return timezoneCurrency;
    }

    // Try browser locale
    const localeCurrency = detectFromLocale();
    if (localeCurrency) {
      return localeCurrency;
    }

    // Fallback to IP-based detection using free API
    const ipCurrency = await detectFromIP();
    if (ipCurrency) {
      return ipCurrency;
    }
  } catch (error) {
    console.error('Currency detection failed:', error);
  }

  // Default to GBP
  return 'GBP';
}

/**
 * Detect currency from browser timezone
 */
function detectFromTimezone(): CurrencyCode | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Map timezones to currencies
    if (timezone.startsWith('America/New_York') ||
        timezone.startsWith('America/Chicago') ||
        timezone.startsWith('America/Denver') ||
        timezone.startsWith('America/Los_Angeles') ||
        timezone.startsWith('America/Phoenix')) {
      return 'USD';
    }
    if (timezone.startsWith('America/Toronto') ||
        timezone.startsWith('America/Vancouver')) {
      return 'CAD';
    }
    if (timezone.startsWith('Europe/London')) {
      return 'GBP';
    }
    if (timezone.startsWith('Europe/') && !timezone.startsWith('Europe/London')) {
      return 'EUR';
    }
    if (timezone.startsWith('Australia/')) {
      return 'AUD';
    }
  } catch {
    // Ignore timezone detection errors
  }
  return null;
}

/**
 * Detect currency from browser locale
 */
function detectFromLocale(): CurrencyCode | null {
  try {
    const locale = navigator.language || navigator.languages?.[0];
    if (!locale) return null;

    // Extract country code from locale (e.g., 'en-US' -> 'US')
    const parts = locale.split('-');
    const countryCode = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();

    return COUNTRY_CURRENCY_MAP[countryCode] || null;
  } catch {
    return null;
  }
}

/**
 * Detect currency from IP address using free API
 */
async function detectFromIP(): Promise<CurrencyCode | null> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) return null;

    const data = await response.json();
    const countryCode = data.country_code?.toUpperCase();

    return countryCode ? (COUNTRY_CURRENCY_MAP[countryCode] || null) : null;
  } catch {
    return null;
  }
}

/**
 * Get saved currency preference
 */
export function getSavedCurrency(): CurrencyCode | null {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (saved && CURRENCIES[saved as CurrencyCode]) {
      return saved as CurrencyCode;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

/**
 * Save currency preference
 */
export function saveCurrencyPreference(currency: CurrencyCode): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Convert amount from USD to target currency
 */
export function convertFromUSD(amountInCents: number, targetCurrency: CurrencyCode): number {
  const rate = CONVERSION_RATES[targetCurrency] || 1;
  return Math.round(amountInCents * rate);
}

/**
 * Convert amount to USD from source currency
 */
export function convertToUSD(amountInCents: number, sourceCurrency: CurrencyCode): number {
  const rate = CONVERSION_RATES[sourceCurrency] || 1;
  return Math.round(amountInCents / rate);
}

/**
 * Format price for display
 */
export function formatPrice(
  amountInCents: number,
  currency: CurrencyCode,
  options?: {
    showCents?: boolean;
    compact?: boolean;
  }
): string {
  const { showCents = false, compact = false } = options || {};
  const currencyInfo = CURRENCIES[currency];
  const amount = amountInCents / 100;

  if (compact && amount >= 1000) {
    const formatter = new Intl.NumberFormat(currencyInfo.locale, {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    return formatter.format(amount);
  }

  const formatter = new Intl.NumberFormat(currencyInfo.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });

  return formatter.format(amount);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCIES[currency]?.symbol || '$';
}

/**
 * Get all available currencies for selector
 */
export function getAvailableCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCIES);
}
