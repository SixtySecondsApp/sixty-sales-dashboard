import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalization } from '../../lib/hooks/useLocalization';
import { LocaleSelector } from '../LocaleSelector';

export function PricingSectionV4() {
  const navigate = useNavigate();
  const { t } = useTranslation('pricing');
  const { locale, setLocale, availableLocales, isLocaleLoading, formatPrice, symbol, convertPrice } = useLocalization();
  const [reps, setReps] = useState(5);

  // V3 ROI calculation
  const hoursPerWeek = 10; // Time saved per rep per week
  const weeksPerMonth = 4.33;
  const hourlyRate = 50; // Average hourly rate for sales rep
  const monthlySavings = reps * hoursPerWeek * weeksPerMonth * hourlyRate;

  // Base prices in USD cents
  const SOLO_PRICE_USD_CENTS = 2900; // $29
  const TEAM_PRICE_USD_CENTS = 7900; // $79

  // Convert and format prices
  const soloPrice = Math.round(convertPrice(SOLO_PRICE_USD_CENTS) / 100); // Convert to whole dollars/pounds
  const teamPrice = Math.round(convertPrice(TEAM_PRICE_USD_CENTS) / 100);

  // Dynamic pricing plans with translations and converted prices
  const plans = [
    {
      key: 'solo',
      name: t('plans.solo.name'),
      price: `${symbol}${soloPrice}`,
      period: t('plans.solo.period'),
      description: t('plans.solo.description'),
      features: t('plans.solo.features', { returnObjects: true }) as string[],
      cta: t('plans.solo.cta'),
      popular: false,
      earlyAdopterNote: t('plans.solo.earlyAdopterNote'),
    },
    {
      key: 'team',
      name: t('plans.team.name'),
      price: `${symbol}${teamPrice}`,
      period: t('plans.team.period'),
      description: t('plans.team.description'),
      features: t('plans.team.features', { returnObjects: true }) as string[],
      cta: t('plans.team.cta'),
      popular: true,
      badge: t('plans.team.badge'),
      earlyAdopterNote: t('plans.team.earlyAdopterNote'),
    },
    {
      key: 'enterprise',
      name: t('plans.enterprise.name'),
      price: t('plans.enterprise.name'), // "Custom"
      period: t('plans.enterprise.period'),
      description: t('plans.enterprise.description'),
      features: t('plans.enterprise.features', { returnObjects: true }) as string[],
      cta: t('plans.enterprise.cta'),
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
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
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
                  {plan.features.map((feature, idx) => (
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
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-xl shadow-blue-500/25'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* V3 ROI Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-500/10 dark:to-emerald-500/10 border border-blue-200 dark:border-blue-500/20">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              {t('roi.title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {t('roi.subtitle')}
            </p>

            <div className="space-y-6">
              {/* Input */}
              <div>
                <label htmlFor="reps" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('roi.inputLabel')}
                </label>
                <input
                  id="reps"
                  type="number"
                  min="1"
                  max="1000"
                  value={reps}
                  onChange={(e) => setReps(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>

              {/* Results */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('roi.results.timeSaved')}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {(reps * hoursPerWeek * weeksPerMonth).toFixed(0)} {t('roi.results.hours')}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('roi.results.estimatedSavings')}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-400 dark:to-green-400 bg-clip-text text-transparent">
                    {symbol}{monthlySavings.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>{t('roi.explanation.title')}</strong> {t('roi.explanation.description', {
                    hourlyRate,
                    monthlySavings: (hoursPerWeek * weeksPerMonth * hourlyRate).toLocaleString()
                  })}
                </p>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button
                  onClick={() => navigate('/auth/signup')}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold px-8 py-6 rounded-xl shadow-xl shadow-blue-500/25"
                >
                  {t('roi.cta')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
