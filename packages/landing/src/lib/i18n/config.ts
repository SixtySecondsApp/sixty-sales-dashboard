// packages/landing/src/lib/i18n/config.ts
// i18next configuration for internationalization

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enUSPricing from '../../locales/en-US/pricing.json';
import enGBPricing from '../../locales/en-GB/pricing.json';

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': {
        pricing: enUSPricing,
      },
      'en-GB': {
        pricing: enGBPricing,
      },
    },
    // Fallback configuration - UK English inherits from US English
    fallbackLng: {
      'en-GB': ['en-US'],
      'default': ['en-US'],
    },
    defaultNS: 'pricing',
    ns: ['pricing'],
    // Detection order for automatic locale detection
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sixty_locale',
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better control
    },
    // Development settings
    debug: false, // Set to true for debugging translation keys
    saveMissing: false, // Set to true to log missing translation keys
  });

export default i18n;
