/**
 * OnboardingV2
 *
 * Main container component for the V2 onboarding flow.
 * Manages step transitions and provides the layout wrapper.
 */

import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useOnboardingV2Store, OnboardingStep } from '@/lib/stores/onboardingV2Store';
import { EnrichmentLoadingStep } from './EnrichmentLoadingStep';
import { EnrichmentResultStep } from './EnrichmentResultStep';
import { SkillsConfigStep } from './SkillsConfigStep';
import { CompletionStep } from './CompletionStep';

interface OnboardingV2Props {
  organizationId: string;
  domain: string;
}

export function OnboardingV2({ organizationId, domain }: OnboardingV2Props) {
  const { step, setOrganizationId, setDomain } = useOnboardingV2Store();

  // Initialize store with organization data
  useEffect(() => {
    setOrganizationId(organizationId);
    setDomain(domain);
  }, [organizationId, domain, setOrganizationId, setDomain]);

  const renderStep = () => {
    switch (step) {
      case 'enrichment_loading':
        return (
          <EnrichmentLoadingStep
            key="loading"
            domain={domain}
            organizationId={organizationId}
          />
        );
      case 'enrichment_result':
        return <EnrichmentResultStep key="result" />;
      case 'skills_config':
        return <SkillsConfigStep key="config" />;
      case 'completion':
        return <CompletionStep key="complete" />;
      default:
        return (
          <EnrichmentLoadingStep
            key="loading"
            domain={domain}
            organizationId={organizationId}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gray-950">
      <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
    </div>
  );
}
