import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { usePlans, useStartFreeTrial, useCurrentSubscription } from '@/lib/hooks/useSubscription';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg } from '@/lib/contexts/OrgContext';
import { PricingCard } from '@/components/subscription/PricingCard';
import { BillingToggle } from '@/components/subscription/BillingToggle';
import { CurrencySelector } from '@/components/subscription/CurrencySelector';
import type { SubscriptionPlan, BillingCycle } from '@/lib/types/subscription';

// Base prices in USD cents
const BASE_PRICES_USD: Record<string, number> = {
  starter: 4900,   // $49
  pro: 7900,       // $79
  team: 12900,     // $129
};

// Plans we want to display
const ALLOWED_PLAN_SLUGS = ['starter', 'pro', 'team'];

// Enterprise plan placeholder
const ENTERPRISE_PLAN: SubscriptionPlan = {
  id: 'enterprise',
  name: 'Enterprise',
  slug: 'enterprise',
  description: 'For large organizations with custom needs',
  price_monthly: 0,
  price_yearly: 0,
  currency: 'USD',
  max_meetings_per_month: null,
  max_users: null,
  max_ai_tokens_per_month: null,
  max_storage_mb: null,
  meeting_retention_months: null,
  included_seats: 0,
  per_seat_price: 0,
  features: {
    ai_summaries: true,
    analytics: true,
    team_insights: true,
    api_access: true,
    custom_branding: true,
    priority_support: true,
    integrations: true,
    sso: true,
    dedicated_support: true,
  },
  stripe_product_id: null,
  stripe_price_id_monthly: null,
  stripe_price_id_yearly: null,
  stripe_seat_price_id: null,
  trial_days: 0,
  is_active: true,
  is_default: false,
  is_free_tier: false,
  is_public: true,
  display_order: 4,
  badge_text: null,
  cta_text: 'Contact Sales',
  cta_url: 'mailto:sales@sixty.ai?subject=Enterprise%20Plan%20Inquiry',
  highlight_features: [],
  stripe_synced_at: null,
  stripe_sync_error: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Feature comparison data
const COMPARISON_FEATURES = [
  { name: 'Monthly calls', starter: '30', pro: '100', team: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Data retention', starter: '6 months', pro: '12 months', team: '2 years', enterprise: 'Unlimited' },
  { name: 'Team members', starter: '1', pro: '1', team: '5 (add more)', enterprise: 'Unlimited' },
  { name: 'AI summaries', starter: true, pro: true, team: true, enterprise: true },
  { name: 'Meeting transcripts', starter: true, pro: true, team: true, enterprise: true },
  { name: 'Action item tracking', starter: true, pro: true, team: true, enterprise: true },
  { name: 'CRM integrations', starter: false, pro: true, team: true, enterprise: true },
  { name: 'Advanced analytics', starter: false, pro: true, team: true, enterprise: true },
  { name: 'Team insights', starter: false, pro: false, team: true, enterprise: true },
  { name: 'API access', starter: false, pro: false, team: true, enterprise: true },
  { name: 'Custom branding', starter: false, pro: false, team: false, enterprise: true },
  { name: 'SSO / SAML', starter: false, pro: false, team: false, enterprise: true },
  { name: 'Dedicated support', starter: false, pro: false, team: false, enterprise: true },
  { name: 'Custom SLA', starter: false, pro: false, team: false, enterprise: true },
];

function FeatureValue({ value, highlight = false }: { value: string | boolean; highlight?: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className={`w-5 h-5 mx-auto ${highlight ? 'text-blue-500' : 'text-emerald-500'}`} />
    ) : (
      <X className="w-5 h-5 mx-auto text-gray-600" />
    );
  }
  return (
    <span className={`text-sm font-medium ${highlight ? 'text-blue-400' : 'text-gray-300'}`}>
      {value}
    </span>
  );
}

export function PricingSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeOrgId: organizationId } = useOrg();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { subscription, trial } = useCurrentSubscription();
  const startTrial = useStartFreeTrial();
  const {
    currency,
    setCurrency,
    formatPrice,
    availableCurrencies,
    isLoading: currencyLoading,
  } = useCurrency();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.slug === 'enterprise') {
      window.location.href = 'mailto:sales@sixty.ai?subject=Enterprise%20Plan%20Inquiry';
      return;
    }

    if (!user) {
      navigate(`/auth/signup?plan=${plan.slug}&billing=${billingCycle}`);
      return;
    }

    if (!organizationId) {
      navigate(`/onboarding?plan=${plan.slug}&billing=${billingCycle}`);
      return;
    }

    setSelectedPlan(plan.id);

    try {
      await startTrial.mutateAsync({
        org_id: organizationId,
        plan_id: plan.id,
      });
      navigate('/dashboard?trial_started=true');
    } catch (error) {
      console.error('Failed to start trial:', error);
      setSelectedPlan(null);
    }
  };

  const displayPlans = plans
    ?.filter(p => ALLOWED_PLAN_SLUGS.includes(p.slug))
    .sort((a, b) => {
      const aIndex = ALLOWED_PLAN_SLUGS.indexOf(a.slug);
      const bIndex = ALLOWED_PLAN_SLUGS.indexOf(b.slug);
      return aIndex - bIndex;
    }) || [];

  const allPlans = [...displayPlans, ENTERPRISE_PLAN];

  const getFormattedPrices = (plan: SubscriptionPlan) => {
    const basePriceUSD = BASE_PRICES_USD[plan.slug as keyof typeof BASE_PRICES_USD] || plan.price_monthly;
    const monthlyPrice = formatPrice(basePriceUSD);
    const yearlyTotal = Math.round(basePriceUSD * 12 * 0.8);
    const yearlyMonthly = formatPrice(Math.round(yearlyTotal / 12));
    const yearlyPrice = formatPrice(yearlyTotal);

    return {
      monthlyPrice,
      yearlyMonthly,
      yearlyPrice,
    };
  };

  return (
    <section id="pricing" className="relative z-10 py-16 sm:py-24 bg-[#0f1419] dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Choose the perfect plan
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
              for your team
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Start with a 14-day free trial. No credit card required.
            <br className="hidden sm:block" />
            Upgrade, downgrade, or cancel anytime.
          </p>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <CurrencySelector
              value={currency}
              onChange={setCurrency}
              currencies={availableCurrencies}
              isLoading={currencyLoading}
            />
            <BillingToggle
              value={billingCycle}
              onChange={setBillingCycle}
              yearlyDiscount={20}
            />
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mb-24">
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[600px] rounded-2xl bg-gray-100 dark:bg-gray-900/50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {allPlans.map((plan, index) => {
                const prices = getFormattedPrices(plan);
                const isEnterprise = plan.slug === 'enterprise';
                const isCurrentPlan = subscription?.plan?.slug === plan.slug;

                return (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    billingCycle={billingCycle}
                    isCurrentPlan={isCurrentPlan}
                    isPopular={plan.slug === 'pro'}
                    isEnterprise={isEnterprise}
                    onSelect={handleSelectPlan}
                    isLoading={selectedPlan === plan.id && startTrial.isPending}
                    formattedPrice={
                      billingCycle === 'yearly' ? prices.yearlyMonthly : prices.monthlyPrice
                    }
                    formattedYearlyPrice={prices.yearlyPrice}
                    yearlyDiscount={20}
                    index={index}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Features Comparison */}
        <div className="border-t border-gray-800/50 pt-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Compare all features
            </h3>
            <p className="text-gray-400">
              Choose the plan that best fits your team's needs
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-700/50">
                  <th className="py-4 px-6 text-left text-sm font-semibold text-white">
                    Feature
                  </th>
                  <th className="py-4 px-6 text-center text-sm font-semibold text-white">
                    Starter
                  </th>
                  <th className="py-4 px-6 text-center text-sm font-semibold text-blue-400">
                    Pro
                  </th>
                  <th className="py-4 px-6 text-center text-sm font-semibold text-white">
                    Team
                  </th>
                  <th className="py-4 px-6 text-center text-sm font-semibold text-white">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feature, index) => (
                  <motion.tr
                    key={feature.name}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors"
                  >
                    <td className="py-4 px-6 text-sm text-gray-300">
                      {feature.name}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.starter} />
                    </td>
                    <td className="py-4 px-6 text-center bg-blue-500/5">
                      <FeatureValue value={feature.pro} highlight />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.team} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.enterprise} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

