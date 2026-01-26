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

  // NOTE: Removed org membership redirect check because:
  // 1. If user is invited (has org membership), ProtectedRoute won't route them to /onboarding
  //    via the needsOnboarding hook in useOnboardingProgress()
  // 2. If user is on /onboarding, they should complete it - don't auto-redirect midway
  // 3. The org membership check was causing infinite redirects between /onboarding and /dashboard
  //    during the normal onboarding flow (when user creates org as part of setup)

  // NOTE: Removed org membership validation here because:
  // 1. New users signing up won't have membership until after onboarding
  // 2. localStorage is already cleared in SetPassword to prevent cached org bypass
  // 3. This validation was breaking the onboarding flow by clearing valid organizationIds

  // Read step from database on mount for resumption after logout
  useEffect(() => {
    const loadProgressFromDatabase = async () => {
      if (!user) return;

      try {
        const { data: progress } = await supabase
          .from('user_onboarding_progress')
          .select('onboarding_step')
          .eq('user_id', user.id)
          .maybeSingle();

        if (progress && progress.onboarding_step !== 'complete') {
          const dbStep = progress.onboarding_step as OnboardingV2Step;

          // Validate it's a V2 step
          if (VALID_STEPS.includes(dbStep)) {
            console.log('[OnboardingV2] Resuming from database step:', dbStep);
            setStep(dbStep);
            return;
          }
        }
      } catch (error) {
        console.error('[OnboardingV2] Error loading progress from database:', error);
      }

      // Fallback: determine initial step based on onboarding context
      const isFreshStart = userEmail && !domain && !organizationId;

      if (isFreshStart) {
        console.log('[OnboardingV2] Fresh start detected (personal email). Starting at website_input');
        setStep('website_input');
        return;
      }

      // For continuing onboarding, validate the URL step is appropriate
      const urlStep = searchParams.get('step') as OnboardingV2Step | null;
      if (urlStep && VALID_STEPS.includes(urlStep)) {
        // CRITICAL: Validate that enrichment_loading is only accessed with proper setup
        // If user tries to jump directly to enrichment_loading without a domain/org, redirect
        if (urlStep === 'enrichment_loading' && !domain && !organizationId) {
          console.warn('[OnboardingV2] Cannot start enrichment without domain/organizationId. Redirecting to website_input');
          setStep('website_input');
          return;
        }

        console.log('[OnboardingV2] Resuming from URL step:', urlStep);
        setStep(urlStep);
      } else {
        // No URL step specified, default to website_input for safety
        console.log('[OnboardingV2] No URL step specified. Starting at website_input');
        setStep('website_input');
      }
    };

    loadProgressFromDatabase();
  }, [user]);

  // Sync store step changes to URL
  useEffect(() => {
    const urlStep = searchParams.get('step');
    if (currentStep && currentStep !== urlStep) {
      setSearchParams({ step: currentStep }, { replace: true });
    }
  }, [currentStep, searchParams, setSearchParams]);

  // Sync current step to database for resumption after logout
  useEffect(() => {
    const syncStepToDatabase = async () => {
      if (!currentStep || currentStep === 'complete' || !user) return;

      try {
        await supabase
          .from('user_onboarding_progress')
          .update({ onboarding_step: currentStep })
          .eq('user_id', user.id);

        console.log('[OnboardingV2] Synced step to database:', currentStep);
      } catch (error) {
        console.error('[OnboardingV2] Failed to sync step to database:', error);
      }
    };

    // Debounce to avoid excessive DB writes
    const timeout = setTimeout(syncStepToDatabase, 1000);
    return () => clearTimeout(timeout);
  }, [currentStep, user]);

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
