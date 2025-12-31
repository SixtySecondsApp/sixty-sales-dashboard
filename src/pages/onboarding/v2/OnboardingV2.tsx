/**
 * OnboardingV2
 *
 * Main container component for the V2 onboarding flow.
 * Manages step transitions and provides the layout wrapper.
 *
 * Flow paths:
 * 1. Corporate email: enrichment_loading → enrichment_result → skills_config → complete
 * 2. Personal email with website: website_input → enrichment_loading → enrichment_result → skills_config → complete
 * 3. Personal email, no website: website_input → manual_enrichment → enrichment_loading → enrichment_result → skills_config → complete
 */

import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useOnboardingV2Store } from '@/lib/stores/onboardingV2Store';
import { WebsiteInputStep } from './WebsiteInputStep';
import { ManualEnrichmentStep } from './ManualEnrichmentStep';
import { EnrichmentLoadingStep } from './EnrichmentLoadingStep';
import { EnrichmentResultStep } from './EnrichmentResultStep';
import { SkillsConfigStep } from './SkillsConfigStep';
import { CompletionStep } from './CompletionStep';

interface OnboardingV2Props {
  organizationId: string;
  domain?: string;
  userEmail?: string;
}

export function OnboardingV2({ organizationId, domain, userEmail }: OnboardingV2Props) {
  const {
    currentStep,
    domain: storeDomain,
    setOrganizationId,
    setDomain,
    setUserEmail,
    startEnrichment,
  } = useOnboardingV2Store();

  // Initialize store with organization data and detect email type
  useEffect(() => {
    setOrganizationId(organizationId);

    // If user email is provided, use it to determine the flow
    if (userEmail) {
      setUserEmail(userEmail);
    } else if (domain) {
      // Legacy: domain provided directly (corporate email path)
      setDomain(domain);
    }
  }, [organizationId, domain, userEmail, setOrganizationId, setDomain, setUserEmail]);

  // Auto-start enrichment for corporate email path
  useEffect(() => {
    const effectiveDomain = storeDomain || domain;
    if (currentStep === 'enrichment_loading' && effectiveDomain && !userEmail) {
      startEnrichment(organizationId, effectiveDomain);
    }
  }, [currentStep, storeDomain, domain, organizationId, userEmail, startEnrichment]);

  const renderStep = () => {
    const effectiveDomain = storeDomain || domain || '';

    switch (currentStep) {
      case 'website_input':
        return <WebsiteInputStep key="website" organizationId={organizationId} />;
      case 'manual_enrichment':
        return <ManualEnrichmentStep key="manual" organizationId={organizationId} />;
      case 'enrichment_loading':
        return (
          <EnrichmentLoadingStep
            key="loading"
            domain={effectiveDomain}
            organizationId={organizationId}
          />
        );
      case 'enrichment_result':
        return <EnrichmentResultStep key="result" />;
      case 'skills_config':
        return <SkillsConfigStep key="config" />;
      case 'complete':
        return <CompletionStep key="complete" />;
      default:
        return (
          <EnrichmentLoadingStep
            key="loading"
            domain={effectiveDomain}
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
