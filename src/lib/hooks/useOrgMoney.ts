import { useMemo } from 'react';
import { useOrg } from '@/lib/contexts/OrgContext';
import { formatMoney, getCurrencySymbol, getDefaultLocaleForCurrency } from '@/lib/services/moneyFormat';

export type OrgMoneyConfig = {
  currencyCode: string;
  locale: string;
  symbol: string;
};

export function useOrgMoney(): {
  config: OrgMoneyConfig;
  formatMoney: (amount: number, options?: { compact?: boolean; minimumFractionDigits?: number; maximumFractionDigits?: number }) => string;
  symbol: string;
  currencyCode: string;
  locale: string;
} {
  const { activeOrg } = useOrg();

  const config = useMemo<OrgMoneyConfig>(() => {
    const currencyCode = (activeOrg?.currency_code || 'GBP').toUpperCase();
    const locale = activeOrg?.currency_locale || getDefaultLocaleForCurrency(currencyCode);
    const symbol = getCurrencySymbol(currencyCode, locale);

    return { currencyCode, locale, symbol };
  }, [activeOrg?.currency_code, activeOrg?.currency_locale]);

  return {
    config,
    formatMoney: (amount, options) =>
      formatMoney(amount, {
        currencyCode: config.currencyCode,
        locale: config.locale,
        minimumFractionDigits: options?.minimumFractionDigits ?? 0,
        maximumFractionDigits: options?.maximumFractionDigits ?? 0,
        compact: options?.compact ?? false,
      }),
    symbol: config.symbol,
    currencyCode: config.currencyCode,
    locale: config.locale,
  };
}
