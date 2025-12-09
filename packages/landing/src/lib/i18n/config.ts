// packages/landing/src/lib/i18n/config.ts
// i18next configuration for internationalization

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enUSPricing from '../../locales/en-US/pricing.json';
import enGBPricing from '../../locales/en-GB/pricing.json';

// Debug: Verify JSON is loaded correctly
console.log('i18n: enUSPricing.header', enUSPricing.header);

// Initialize i18next synchronously
// CRITICAL: initReactI18next must be used BEFORE init() to ensure proper setup
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
      'default': ['en-GB'],
    },
    defaultNS: 'pricing',
    ns: ['pricing'],
    lng: 'en-GB', // Set default language explicitly
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
    debug: true, // Set to true for debugging translation keys
    saveMissing: true, // Set to true to log missing translation keys
  })
  .then(() => {
    // Ensure react-i18next has the i18n instance
    console.log('i18n init completed, isInitialized:', i18n.isInitialized);
    // Explicitly ensure react-i18next is initialized with this i18n instance
    if (!i18n.isInitialized) {
      console.error('i18n failed to initialize!');
    }
  })
  .catch((err) => {
    console.error('i18n initialization failed:', err);
  });

// Debug: Log initialization status
console.log('i18n initialized:', i18n.isInitialized);
console.log('i18n language:', i18n.language);
console.log('i18n has changeLanguage:', typeof i18n.changeLanguage === 'function');
if (i18n.store && i18n.store.data) {
  console.log('i18n resources loaded:', Object.keys(i18n.store.data));
  const enUSResource = i18n.store.data['en-US'] as any;
  if (enUSResource?.pricing) {
    console.log('i18n pricing resource header:', enUSResource.pricing.header);
  }
}

export default i18n;
