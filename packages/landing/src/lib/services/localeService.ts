// packages/landing/src/lib/services/localeService.ts
// Locale detection service for internationalization

export type LocaleCode = 'en-US' | 'en-GB';

export interface LocaleInfo {
  code: LocaleCode;
  name: string;
  flag: string;
  currency: string;
}

// Locale definitions
export const LOCALES: Record<LocaleCode, LocaleInfo> = {
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    flag: '🇺🇸',
    currency: 'USD'
  },
  'en-GB': {
    code: 'en-GB',
    name: 'English (UK)',
    flag: '🇬🇧',
    currency: 'GBP'
  },
};

// Timezone to locale mapping
const TIMEZONE_LOCALE_MAP: Record<string, LocaleCode> = {
  'Europe/London': 'en-GB',
  'Europe/Dublin': 'en-GB',
  'America/New_York': 'en-US',
  'America/Chicago': 'en-US',
  'America/Denver': 'en-US',
  'America/Los_Angeles': 'en-US',
  'America/Phoenix': 'en-US',
  'America/Anchorage': 'en-US',
  'Pacific/Honolulu': 'en-US',
};

// Country to locale mapping
const COUNTRY_LOCALE_MAP: Record<string, LocaleCode> = {
  US: 'en-US',
  GB: 'en-GB',
  UK: 'en-GB',
};

// Storage key
const LOCALE_STORAGE_KEY = 'sixty_locale';

/**
 * Detect user's locale automatically
 */
export async function detectUserLocale(): Promise<LocaleCode> {
  // Check saved preference first
  const savedLocale = getSavedLocale();
  if (savedLocale) {
    return savedLocale;
  }

  try {
    // Try timezone detection (fastest)
    const timezoneLocale = detectFromTimezone();
    if (timezoneLocale) {
      return timezoneLocale;
    }

    // Try browser locale
    const browserLocale = detectFromBrowserLocale();
    if (browserLocale) {
      return browserLocale;
    }

    // Try IP-based detection
    const ipLocale = await detectFromIP();
    if (ipLocale) {
      return ipLocale;
    }
  } catch (error) {
    console.error('Locale detection failed:', error);
  }

  // Default to UK English
  return 'en-GB';
}

/**
 * Detect from timezone
 */
function detectFromTimezone(): LocaleCode | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_LOCALE_MAP[timezone] || null;
  } catch {
    return null;
  }
}

/**
 * Detect from browser locale
 */
function detectFromBrowserLocale(): LocaleCode | null {
  try {
    const browserLang = navigator.language;

    if (browserLang.startsWith('en-GB') || browserLang.startsWith('en-UK')) {
      return 'en-GB';
    }
    if (browserLang.startsWith('en')) {
      return 'en-US';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect from IP address using free API
 */
async function detectFromIP(): Promise<LocaleCode | null> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const countryCode = data.country_code;

    return COUNTRY_LOCALE_MAP[countryCode] || null;
  } catch {
    return null;
  }
}

/**
 * Get saved locale from localStorage
 */
function getSavedLocale(): LocaleCode | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && (saved === 'en-US' || saved === 'en-GB')) {
      return saved as LocaleCode;
    }
  } catch {
    // localStorage might not be available
  }
  return null;
}

/**
 * Save locale preference
 */
export function saveLocalePreference(locale: LocaleCode): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage might not be available
  }
}

/**
 * Get locale info
 */
export function getLocaleInfo(locale: LocaleCode): LocaleInfo {
  return LOCALES[locale];
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): LocaleInfo[] {
  return Object.values(LOCALES);
}

/**
 * Get currency for locale
 */
export function getCurrencyForLocale(locale: LocaleCode): string {
  return LOCALES[locale].currency;
}
