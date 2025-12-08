import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight, Building2, Shield, Users, Headphones } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalization } from '../../lib/hooks/useLocalization';
import { LocaleSelector } from '../LocaleSelector';
import { usePublicPlans } from '@/lib/hooks/useSubscription';
import type { SubscriptionPlan } from '@/lib/types/subscription';

export function PricingSectionV4() {
  const navigate = useNavigate();
  const { t, ready } = useTranslation('pricing');
  const { locale, setLocale, availableLocales, isLocaleLoading, formatPrice, symbol, convertPrice } = useLocalization();
  const [reps, setReps] = useState(5);

  // Helper function to safely get translations with fallbacks
  const getTranslation = (key: string, fallback: string): string => {
    if (!ready) return fallback;
    const translation = t(key);
    // If translation returns the key itself, it means translation wasn't found
    return translation === key ? fallback : translation;
  };

  // Fetch plans from database
  const { data: dbPlans, isLoading: plansLoading } = usePublicPlans();

  // V3 ROI calculation
  const hoursPerWeek = 10; // Time saved per rep per week
  const weeksPerMonth = 4.33;
  const hourlyRate = 50; // Average hourly rate for sales rep
  const monthlySavings = reps * hoursPerWeek * weeksPerMonth * hourlyRate;

  // Sort plans by display_order from database
  const allPlans = (dbPlans || []).sort((a, b) =>
    (a.display_order || 0) - (b.display_order || 0)
  );

  // Separate core plans from enterprise
  const corePlans = allPlans.filter(p =>
    p.slug !== 'enterprise' &&
    !(p.cta_url?.toLowerCase().includes('contact') || p.cta_url?.toLowerCase().includes('sales'))
  );

  const enterprisePlan = allPlans.find(p =>
    p.slug === 'enterprise' ||
    (p.cta_url?.toLowerCase().includes('contact') || p.cta_url?.toLowerCase().includes('sales'))
  );

  // Helper to get features array from plan
  const getPlanFeatures = (plan: SubscriptionPlan): string[] => {
    // Use highlight_features if available
    if (plan.highlight_features && Array.isArray(plan.highlight_features) && plan.highlight_features.length > 0) {
      return plan.highlight_features;
    }

    // Build features from plan data
    const features: string[] = [];

    // Meeting limit
    if (plan.is_free_tier) {
      features.push(`${plan.max_meetings_per_month || 30} free meetings total`);
    } else if (plan.max_meetings_per_month) {
      features.push(`${plan.max_meetings_per_month} meetings per month`);
    } else {
      features.push('Unlimited meetings');
    }

    // Add standard features
    features.push('AI meeting summaries');
    features.push('Meeting transcripts');
    features.push('Action item tracking');

    // Add feature flags
    if (plan.features?.analytics) features.push('Analytics dashboard');
    if (plan.features?.team_insights) features.push('Team insights');
    if (plan.features?.api_access) features.push('API access');
    if (plan.features?.priority_support) features.push('Priority support');

    return features;
  };

  // Format price for display
  const formatPlanPrice = (plan: SubscriptionPlan): string => {
    if (plan.is_free_tier) return `${symbol}0`;
    if (plan.slug === 'enterprise' || plan.price_monthly === 0) return getTranslation('plans.enterprise.name', 'Custom');

    // Convert price from cents to whole units
    const priceInCents = plan.price_monthly;
    const convertedPrice = Math.round(convertPrice(priceInCents) / 100);
    return `${symbol}${convertedPrice}`;
  };

  // Navigation logic
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.cta_url) {
      window.location.href = plan.cta_url;
      return;
    }

    if (plan.slug === 'enterprise') {
      navigate('/contact');
    } else {
      navigate('/auth/signup?plan=' + plan.slug);
    }
  };

  return (
    <section id="pricing" className="relative py-24 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              {getTranslation('header.title', 'Simple, transparent')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
              {getTranslation('header.titleHighlight', 'pricing')}
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {getTranslation('header.subtitle', 'Start free, upgrade when you need more. No hidden fees.')}
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

        {/* Core Pricing Cards */}
        <div className="mb-12">
          {plansLoading ? (
            <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[500px] rounded-2xl bg-gray-200 dark:bg-gray-800/50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {corePlans.map((plan, index) => {
                const isPopular = plan.badge_text?.toLowerCase().includes('popular') || plan.slug === 'pro';
                const features = getPlanFeatures(plan);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className={`relative ${isPopular ? 'lg:scale-105' : ''}`}
                  >
                    {/* Popular badge */}
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                        <div className="px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-sm font-medium flex items-center gap-1 shadow-lg">
                          <Sparkles className="w-4 h-4" />
                          {plan.badge_text || 'Most Popular'}
                        </div>
                      </div>
                    )}

                    {/* Card */}
                    <div
                      className={`h-full p-8 rounded-2xl bg-white dark:bg-gray-800/50 backdrop-blur-sm border ${
                        isPopular
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
                          <span className="text-5xl font-bold text-gray-900 dark:text-white">
                            {formatPlanPrice(plan)}
                          </span>
                          {!plan.is_free_tier && plan.price_monthly > 0 && (
                            <span className="text-gray-600 dark:text-gray-400">/month</span>
                          )}
                        </div>
                        {plan.is_free_tier && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                            No credit card required
                          </p>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-4 mb-8">
                        {features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA Button */}
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        variant={isPopular ? undefined : 'secondary'}
                        className={`w-full py-6 rounded-xl font-semibold transition-all ${
                          isPopular
                            ? 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 !text-white shadow-xl shadow-blue-500/25 border-0'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-0'
                        }`}
                      >
                        {plan.cta_text || (plan.is_free_tier ? 'Get Started Free' : 'Start Free Trial')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enterprise Banner */}
        {enterprisePlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 md:p-12">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/20 via-blue-500/10 to-transparent" />
              <div className="absolute bottom-0 left-0 w-1/3 h-2/3 bg-gradient-to-tr from-emerald-500/15 to-transparent" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

              <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                {/* Left side - Text content */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/20 backdrop-blur-sm">
                      <Building2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white">
                      Custom
                    </h3>
                  </div>
                  <p className="text-gray-300 text-lg mb-6 max-w-xl">
                    For organisations with custom needs. Custom integrations, custom functions, and custom features tailored to your workflow.
                  </p>

                  {/* Custom features grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-gray-200">
                      <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-medium">Custom integrations</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Users className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-medium">Unlimited users</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Headphones className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-medium">Dedicated support</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-medium">Custom features</span>
                    </div>
                  </div>
                </div>

                {/* Right side - CTA */}
                <div className="flex flex-col items-center lg:items-end gap-4">
                  <div className="text-center lg:text-right">
                    <p className="text-3xl font-bold text-white mb-1">Let's Talk</p>
                    <p className="text-gray-400 text-sm">We'll build it together</p>
                  </div>
                  <Button
                    onClick={() => handleSelectPlan(enterprisePlan)}
                    variant={undefined}
                    className="px-8 py-4 rounded-xl bg-white !text-slate-900 font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl border-0"
                  >
                    {enterprisePlan.cta_text || 'Contact Us'}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ROI Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-500/10 dark:to-emerald-500/10 border border-blue-200 dark:border-blue-500/20">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              {getTranslation('roi.title', 'Calculate Your ROI')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {getTranslation('roi.subtitle', 'See how much time and money you could save')}
            </p>

            <div className="space-y-6">
              {/* Input */}
              <div>
                <label htmlFor="reps" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {getTranslation('roi.inputLabel', 'Number of sales reps')}
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{getTranslation('roi.results.timeSaved', 'Time saved per month')}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {(reps * hoursPerWeek * weeksPerMonth).toFixed(0)} {getTranslation('roi.results.hours', 'hours')}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{getTranslation('roi.results.estimatedSavings', 'Estimated savings')}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-400 dark:to-green-400 bg-clip-text text-transparent">
                    {symbol}{monthlySavings.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>{getTranslation('roi.explanation.title', 'How we calculate:')}</strong> {ready ? t('roi.explanation.description', {
                    hourlyRate,
                    monthlySavings: (hoursPerWeek * weeksPerMonth * hourlyRate).toLocaleString()
                  }) : `Based on ${hoursPerWeek} hours saved per rep per week at $${hourlyRate}/hour.`}
                </p>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button
                  onClick={() => navigate('/auth/signup')}
                  size="lg"
                  variant={undefined}
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 !text-white font-semibold px-8 py-6 rounded-xl shadow-xl shadow-blue-500/25 border-0"
                >
                  {getTranslation('roi.cta', 'Start Saving Time Today')}
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
