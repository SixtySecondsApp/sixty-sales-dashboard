/**
 * OnboardingV2
 *
 * Main container component for the V2 onboarding flow.
 * Manages step transitions and provides the layout wrapper.
 * Uses URL query params (?step=xxx) for reliable step tracking.
 *
 * Flow paths:
 * 1. Corporate email: enrichment_loading → enrichment_result → skills_config → complete
 * 2. Personal email with website: website_input → enrichment_loading → enrichment_result → skills_config → complete
 * 3. Personal email, no website: website_input → manual_enrichment → enrichment_loading → enrichment_result → skills_config → complete
 *
 * Phase 7 update: Added PlatformSkillConfigStep for platform-controlled skills
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useOnboardingV2Store, type OnboardingV2Step } from '@/lib/stores/onboardingV2Store';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { WebsiteInputStep } from './WebsiteInputStep';
import { ManualEnrichmentStep } from './ManualEnrichmentStep';
import { PendingApprovalStep } from './PendingApprovalStep';
import { EnrichmentLoadingStep } from './EnrichmentLoadingStep';
import { EnrichmentResultStep } from './EnrichmentResultStep';
import { SkillsConfigStep } from './SkillsConfigStep';
import { PlatformSkillConfigStep } from './PlatformSkillConfigStep';
import { CompletionStep } from './CompletionStep';

// Feature flag for platform skills (Phase 7)
// Set to false to use the original tabbed SkillsConfigStep
const USE_PLATFORM_SKILLS = false;

// Valid steps for URL param validation
const VALID_STEPS: OnboardingV2Step[] = [
  'website_input',
  'manual_enrichment',
  'pending_approval',
  'enrichment_loading',
  'enrichment_result',
  'skills_config',
  'complete',
];

interface OnboardingV2Props {
  organizationId: string;
  domain?: string;
  userEmail?: string;
}

export function OnboardingV2({ organizationId, domain, userEmail }: OnboardingV2Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentStep,
    domain: storeDomain,
    setOrganizationId,
    setDomain,
    setUserEmail,
    setStep,
    startEnrichment,
  } = useOnboardingV2Store();

  // Skip onboarding if user already has organization membership (invited users)
  useEffect(() => {
    if (!user) return;

    const checkOrgMembership = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_memberships')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (!error && data && data.length > 0) {
          // User already has organization membership (invited), skip to dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        console.error('[OnboardingV2] Error checking organization membership:', err);
      }
    };

    checkOrgMembership();
  }, [user, navigate]);

  // Validate that organizationId prop matches actual membership (prevents cached org bypass)
  useEffect(() => {
    if (!user || !organizationId) return;

    const validateOrgId = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', organizationId)
          .maybeSingle();

        if (error || !data) {
          // User doesn't have membership in this org - clear it
          console.warn('[OnboardingV2] User has no membership in org:', organizationId);
          setOrganizationId(''); // Clear invalid org ID
        }
      } catch (err) {
        console.error('[OnboardingV2] Error validating org membership:', err);
      }
    };

    validateOrgId();
  }, [user, organizationId, setOrganizationId]);

  // Read step from URL on mount
  useEffect(() => {
    const urlStep = searchParams.get('step') as OnboardingV2Step | null;
    if (urlStep && VALID_STEPS.includes(urlStep)) {
      setStep(urlStep);
    }
  }, []); // Only run on mount

  // Sync store step changes to URL
  useEffect(() => {
    const urlStep = searchParams.get('step');
    if (currentStep && currentStep !== urlStep) {
      setSearchParams({ step: currentStep }, { replace: true });
    }
  }, [currentStep, searchParams, setSearchParams]);

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
      case 'pending_approval':
        return <PendingApprovalStep key="pending" />;
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
        // Phase 7: Use platform skills if feature flag is enabled
        return USE_PLATFORM_SKILLS ? (
          <PlatformSkillConfigStep key="platform-config" />
        ) : (
          <SkillsConfigStep key="config" />
        );
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
