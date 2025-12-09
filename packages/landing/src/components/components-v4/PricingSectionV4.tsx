import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalization } from '../../lib/hooks/useLocalization';
import { LocaleSelector } from '../LocaleSelector';
import i18n from '../../lib/i18n/config';

export function PricingSectionV4() {
  const navigate = useNavigate();
  
  // Wait for i18n to be initialized before using translations
  if (!i18n.isInitialized) {
    console.warn('PricingSectionV4 - i18n not initialized, waiting...');
    return <div>Loading...</div>;
  }
  
  const { t } = useTranslation('pricing');
  const { locale, setLocale, availableLocales, isLocaleLoading, formatPrice, symbol, convertPrice } = useLocalization();
  
  // Debug: Log translation status
  console.log('PricingSectionV4 - i18n initialized:', i18n.isInitialized);
  console.log('PricingSectionV4 - current language:', i18n.language);
  console.log('PricingSectionV4 - namespace:', i18n.options?.defaultNS);
  console.log('PricingSectionV4 - t("header.title"):', t('header.title'));
  console.log('PricingSectionV4 - available resources:', i18n.store?.data ? Object.keys(i18n.store.data) : 'no store');

  // Base prices in USD cents
  const SOLO_PRICE_USD_CENTS = 0; // Free
  const TEAM_PRICE_USD_CENTS = 10000; // $100 (to convert to ~£79)

  // Convert and format prices
  const soloPrice = 'Free'; // Free plan
  const teamPrice = locale === 'en-GB' ? 79 : Math.round(convertPrice(TEAM_PRICE_USD_CENTS) / 100); // £79 for UK, converted price for US

  // Helper function to ensure features is always an array
  const getFeaturesArray = (key: string): string[] => {
    const features = t(key, { returnObjects: true });
    return Array.isArray(features) ? features : [];
  };

  // Dynamic pricing plans with translations and converted prices
  const plans = [
    {
      key: 'solo',
      name: t('plans.solo.name'),
      price: soloPrice,
      period: t('plans.solo.period'),
      description: t('plans.solo.description'),
      features: getFeaturesArray('plans.solo.features'),
      cta: t('plans.solo.cta'),
      popular: false,
      earlyAdopterNote: t('plans.solo.earlyAdopterNote'),
    },
    {
      key: 'team',
      name: t('plans.team.name'),
      price: locale === 'en-GB' ? `£${teamPrice}` : '$99',
      period: t('plans.team.period'),
      description: t('plans.team.description'),
      features: getFeaturesArray('plans.team.features'),
      cta: t('plans.team.cta'),
      popular: true,
      badge: t('plans.team.badge'),
      earlyAdopterNote: t('plans.team.earlyAdopterNote'),
    },
    {
      key: 'enterprise',
      name: t('plans.enterprise.name'),
      price: locale === 'en-GB' ? '£129' : '$169',
      period: t('plans.enterprise.period'),
      description: t('plans.enterprise.description'),
      features: getFeaturesArray('plans.enterprise.features'),
      cta: t('plans.enterprise.cta'),
      earlyAdopterNote: t('plans.enterprise.earlyAdopterNote'),
      popular: false,
    },
  ];

  // V1 Navigation logic - simplified for landing page
  const handleSelectPlan = (planName: string) => {
    if (planName === 'Enterprise') {
      // Navigate to contact/sales page
      navigate('/contact');
    } else {
      // Navigate to waitlist page
      navigate('/waitlist');
    }
  };

  return (
    <section id="pricing" className="relative py-24 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* V3 Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="text-gray-900 dark:text-white">
              {t('header.title')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
              {t('header.titleHighlight')}
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('header.subtitle')}
          </p>

          {/* Locale Selector */}
          <div className="flex justify-center mt-6">
            <LocaleSelector
              value={locale}
              onChange={setLocale}
              locales={availableLocales}
              isLoading={isLocaleLoading}
            />
          </div>
        </motion.div>

        {/* V3 Pricing Cards with V1 Navigation */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${plan.popular ? 'lg:scale-105' : ''}`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-sm font-medium flex items-center gap-1 shadow-lg">
                    <Sparkles className="w-4 h-4" />
                    {plan.badge}
                  </div>
                </div>
              )}

              {/* Card */}
              <div
                className={`h-full p-8 rounded-2xl bg-white dark:bg-gray-800/50 backdrop-blur-sm border ${
                  plan.popular
                    ? 'border-blue-500 dark:border-blue-400 shadow-xl shadow-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none'
                } transition-all duration-300 hover:shadow-xl dark:hover:shadow-none`}
              >
                {/* Plan name */}
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    {plan.period && <span className="text-gray-600 dark:text-gray-400">{plan.period}</span>}
                  </div>
                  {plan.earlyAdopterNote && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                      {plan.earlyAdopterNote}
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* V1 Functional CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full py-6 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 !text-white dark:!text-white shadow-xl shadow-blue-500/25'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className={`ml-2 w-5 h-5 ${plan.popular ? 'text-white dark:text-white' : ''}`} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
