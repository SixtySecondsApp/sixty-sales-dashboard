// packages/landing/src/lib/hooks/useLocalization.ts
// Combined hook for locale and currency management

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from './useCurrency';
import {
  LocaleCode,
  LocaleInfo,
  detectUserLocale,
  saveLocalePreference,
  getLocaleInfo,
  getAvailableLocales,
  getCurrencyForLocale,
} from '../services/localeService';
import type { CurrencyCode } from '../services/currencyService';

interface UseLocalizationReturn {
  // Locale properties
  locale: LocaleCode;
  localeInfo: LocaleInfo;
  isLocaleLoading: boolean;
  setLocale: (locale: LocaleCode) => void;
  availableLocales: LocaleInfo[];
  isUK: boolean;
  isUS: boolean;

  // Translation function
  t: (key: string, options?: any) => string;

  // Currency properties (from useCurrency)
  currency: CurrencyCode;
  currencyInfo: any;
  isCurrencyLoading: boolean;
  setCurrency: (currency: CurrencyCode) => void;
  convertPrice: (amountInCentsUSD: number) => number;
  formatPrice: (amountInCentsUSD: number, options?: { showCents?: boolean; compact?: boolean }) => string;
  symbol: string;
  availableCurrencies: any[];
}

// Coupled locale-currency mapping
const LOCALE_CURRENCY_MAP: Record<LocaleCode, CurrencyCode> = {
  'en-GB': 'GBP',
  'en-US': 'USD',
};

export function useLocalization(): UseLocalizationReturn {
  const { t, i18n } = useTranslation();
  const currencyHook = useCurrency();
  const [locale, setLocaleState] = useState<LocaleCode>('en-GB');
  const [isLocaleLoading, setIsLocaleLoading] = useState(true);

  // Detect user's locale on mount
  useEffect(() => {
    let mounted = true;

    async function detect() {
      try {
        const detected = await detectUserLocale();
        if (mounted) {
          setLocaleState(detected);
          // Initialize i18next with detected locale
          await i18n.changeLanguage(detected);
        }
      } catch (error) {
        console.error('Failed to detect locale:', error);
      } finally {
        if (mounted) {
          setIsLocaleLoading(false);
        }
      }
    }

    detect();

    return () => {
      mounted = false;
    };
  }, [i18n]);

  // Set locale and automatically update coupled currency
  const setLocale = useCallback(
    (newLocale: LocaleCode) => {
      setLocaleState(newLocale);
      saveLocalePreference(newLocale);

      // Change i18next language
      i18n.changeLanguage(newLocale);

      // Auto-update coupled currency
      const currency = LOCALE_CURRENCY_MAP[newLocale];
      if (currency) {
        currencyHook.setCurrency(currency);
      }
    },
    [i18n, currencyHook]
  );

  // Get current locale from i18next (in case it was changed externally)
  const currentLocale = (i18n.language as LocaleCode) || locale;

  return {
    // Locale properties
    locale: currentLocale,
    localeInfo: getLocaleInfo(currentLocale),
    isLocaleLoading,
    setLocale,
    availableLocales: getAvailableLocales(),
    isUK: currentLocale === 'en-GB',
    isUS: currentLocale === 'en-US',

    // Translation function
    t,

    // Currency properties (spread from useCurrency)
    currency: currencyHook.currency,
    currencyInfo: currencyHook.currencyInfo,
    isCurrencyLoading: currencyHook.isLoading,
    setCurrency: currencyHook.setCurrency,
    convertPrice: currencyHook.convertPrice,
    formatPrice: currencyHook.formatPrice,
    symbol: currencyHook.symbol,
    availableCurrencies: currencyHook.availableCurrencies,
  };
}

export default useLocalization;
