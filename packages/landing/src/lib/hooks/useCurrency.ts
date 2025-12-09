// src/lib/hooks/useCurrency.ts
// React hook for currency management

import { useState, useEffect, useCallback } from 'react';
import {
  CurrencyCode,
  CurrencyInfo,
  detectUserCurrency,
  saveCurrencyPreference,
  convertFromUSD,
  formatPrice,
  getCurrencySymbol,
  getAvailableCurrencies,
  CURRENCIES,
} from '../services/currencyService';

interface UseCurrencyReturn {
  currency: CurrencyCode;
  currencyInfo: CurrencyInfo;
  isLoading: boolean;
  setCurrency: (currency: CurrencyCode) => void;
  convertPrice: (amountInCentsUSD: number) => number;
  formatPrice: (amountInCentsUSD: number, options?: { showCents?: boolean; compact?: boolean }) => string;
  symbol: string;
  availableCurrencies: CurrencyInfo[];
}

export function useCurrency(): UseCurrencyReturn {
  const [currency, setCurrencyState] = useState<CurrencyCode>('GBP');
  const [isLoading, setIsLoading] = useState(true);

  // Detect user's currency on mount
  useEffect(() => {
    let mounted = true;

    async function detect() {
      try {
        const detected = await detectUserCurrency();
        if (mounted) {
          setCurrencyState(detected);
        }
      } catch (error) {
        console.error('Failed to detect currency:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    detect();

    return () => {
      mounted = false;
    };
  }, []);

  // Set currency and save preference
  const setCurrency = useCallback((newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    saveCurrencyPreference(newCurrency);
  }, []);

  // Convert price from USD to current currency
  const convertPrice = useCallback(
    (amountInCentsUSD: number) => {
      return convertFromUSD(amountInCentsUSD, currency);
    },
    [currency]
  );

  // Format price in current currency
  const formatPriceInCurrency = useCallback(
    (amountInCentsUSD: number, options?: { showCents?: boolean; compact?: boolean }) => {
      const converted = convertFromUSD(amountInCentsUSD, currency);
      return formatPrice(converted, currency, options);
    },
    [currency]
  );

  return {
    currency,
    currencyInfo: CURRENCIES[currency],
    isLoading,
    setCurrency,
    convertPrice,
    formatPrice: formatPriceInCurrency,
    symbol: getCurrencySymbol(currency),
    availableCurrencies: getAvailableCurrencies(),
  };
}

export default useCurrency;
