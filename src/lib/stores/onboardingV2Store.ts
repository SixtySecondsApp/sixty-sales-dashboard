/**
 * Onboarding V2 Store
 *
 * Manages state for the skills-based onboarding flow including:
 * - Enrichment data from AI analysis (or manual Q&A input)
 * - Skill configurations (AI-generated and user-modified)
 * - Step navigation and progress
 * - Personal email handling (website input / Q&A fallback)
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/clientV2';

// ============================================================================
// Constants
// ============================================================================

// List of personal email domains that cannot be enriched via website scraping
export const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'ymail.com',
  'live.com',
  'msn.com',
  'me.com',
  'mac.com',
];

// ============================================================================
// Types
// ============================================================================

export interface EnrichmentData {
  id: string;
  organization_id: string;
  domain: string;
  status: 'pending' | 'scraping' | 'analyzing' | 'completed' | 'failed';
  error_message?: string;
  company_name?: string;
  logo_url?: string;
  tagline?: string;
  description?: string;
  industry?: string;
  employee_count?: string;
  products?: Array<{ name: string; description?: string; pricing_tier?: string }>;
  value_propositions?: string[];
  competitors?: Array<{ name: string; domain?: string }>;
  target_market?: string;
  tech_stack?: string[];
  key_people?: Array<{ name: string; title: string }>;
  pain_points?: string[];
  confidence_score?: number;
  generated_skills?: SkillConfigs;
  // Track enrichment source
  enrichment_source?: 'website' | 'manual';
}

/**
 * Manual enrichment data collected via Q&A flow
 * Used when user doesn't have a website to scrape
 */
export interface ManualEnrichmentData {
  company_name: string;
  company_description: string;
  industry: string;
  target_customers: string;
  main_products: string;
  competitors: string;
  team_size?: string;
  unique_value?: string;
}

export interface SkillConfigs {
  lead_qualification: {
    criteria: string[];
    disqualifiers: string[];
  };
  lead_enrichment: {
    questions: string[];
  };
  brand_voice: {
    tone: string;
    avoid: string[];
  };
  objection_handling: {
    objections: Array<{ trigger: string; response: string }>;
  };
  icp: {
    companyProfile: string;
    buyerPersona: string;
    buyingSignals: string[];
  };
}

export type SkillId = 'lead_qualification' | 'lead_enrichment' | 'brand_voice' | 'objection_handling' | 'icp';

export interface SkillMeta {
  id: SkillId;
  name: string;
  description: string;
}

export const SKILLS: SkillMeta[] = [
  { id: 'lead_qualification', name: 'Qualification', description: 'Define how leads are scored and qualified' },
  { id: 'lead_enrichment', name: 'Enrichment', description: 'Customize discovery questions' },
  { id: 'brand_voice', name: 'Brand Voice', description: 'Set your communication style' },
  { id: 'objection_handling', name: 'Objections', description: 'Define response playbooks' },
  { id: 'icp', name: 'ICP', description: 'Describe your perfect customers' },
];

/**
 * All possible steps in the V2 onboarding flow
 *
 * Flow paths:
 * 1. Corporate email: enrichment_loading → enrichment_result → skills_config → complete
 * 2. Personal email with website: website_input → enrichment_loading → enrichment_result → skills_config → complete
 * 3. Personal email, no website: website_input → manual_enrichment → enrichment_loading → enrichment_result → skills_config → complete
 */
export type OnboardingV2Step =
  | 'website_input'        // Ask for website URL (personal email users)
  | 'manual_enrichment'    // Q&A fallback (no website available)
  | 'enrichment_loading'   // AI analyzing company
  | 'enrichment_result'    // Show what we learned
  | 'skills_config'        // Configure 5 skills
  | 'complete';            // All done!

// Legacy type alias for backward compatibility
export type OnboardingStep = OnboardingV2Step;

interface OnboardingV2State {
  // Organization context
  organizationId: string | null;
  domain: string | null;
  userEmail: string | null;
  isPersonalEmail: boolean;

  // Step management
  currentStep: OnboardingV2Step;
  currentSkillIndex: number;

  // Website input (for personal email users)
  websiteUrl: string | null;
  hasNoWebsite: boolean;

  // Manual enrichment data (Q&A fallback)
  manualData: ManualEnrichmentData | null;

  // Enrichment data
  enrichment: EnrichmentData | null;
  isEnrichmentLoading: boolean;
  enrichmentError: string | null;
  enrichmentSource: 'website' | 'manual' | null;

  // Skill configurations
  skillConfigs: SkillConfigs;
  configuredSkills: SkillId[];
  skippedSkills: SkillId[];

  // Saving state
  isSaving: boolean;
  saveError: string | null;

  // Context setters
  setOrganizationId: (id: string) => void;
  setDomain: (domain: string) => void;
  setUserEmail: (email: string) => void;

  // Actions
  setStep: (step: OnboardingV2Step) => void;
  setCurrentSkillIndex: (index: number) => void;

  // Website input actions
  setWebsiteUrl: (url: string) => void;
  setHasNoWebsite: (value: boolean) => void;
  submitWebsite: (organizationId: string) => Promise<void>;

  // Manual enrichment actions
  setManualData: (data: ManualEnrichmentData) => void;
  submitManualEnrichment: (organizationId: string) => Promise<void>;

  // Enrichment actions
  startEnrichment: (organizationId: string, domain: string) => Promise<void>;
  pollEnrichmentStatus: (organizationId: string) => Promise<void>;
  setEnrichment: (data: EnrichmentData) => void;

  // Skill actions
  updateSkillConfig: <K extends SkillId>(skillId: K, config: SkillConfigs[K]) => void;
  markSkillConfigured: (skillId: SkillId) => void;
  markSkillSkipped: (skillId: SkillId) => void;
  resetSkillConfig: (skillId: SkillId) => void;

  // Save actions
  saveAllSkills: (organizationId: string) => Promise<boolean>;

  // Reset
  reset: () => void;
}

// ============================================================================
// Default Skill Configs
// ============================================================================

const defaultSkillConfigs: SkillConfigs = {
  lead_qualification: {
    criteria: [],
    disqualifiers: [],
  },
  lead_enrichment: {
    questions: [],
  },
  brand_voice: {
    tone: '',
    avoid: [],
  },
  objection_handling: {
    objections: [],
  },
  icp: {
    companyProfile: '',
    buyerPersona: '',
    buyingSignals: [],
  },
};

// ============================================================================
// Store
// ============================================================================

/**
 * Check if an email domain is a personal email provider
 */
export function isPersonalEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

/**
 * Extract domain from URL or email
 */
export function extractDomain(input: string): string {
  // If it's an email, extract domain
  if (input.includes('@')) {
    return input.split('@')[1]?.toLowerCase() || '';
  }
  // If it's a URL, extract domain
  try {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // Just clean up the input as a domain
    return input.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
  }
}

export const useOnboardingV2Store = create<OnboardingV2State>((set, get) => ({
  // Initial state - organization context
  organizationId: null,
  domain: null,
  userEmail: null,
  isPersonalEmail: false,

  // Step management
  currentStep: 'enrichment_loading',
  currentSkillIndex: 0,

  // Website input state
  websiteUrl: null,
  hasNoWebsite: false,

  // Manual enrichment state
  manualData: null,

  // Enrichment state
  enrichment: null,
  isEnrichmentLoading: false,
  enrichmentError: null,
  enrichmentSource: null,

  // Skill state
  skillConfigs: defaultSkillConfigs,
  configuredSkills: [],
  skippedSkills: [],

  // Saving state
  isSaving: false,
  saveError: null,

  // Context setters
  setOrganizationId: (id) => set({ organizationId: id }),
  setDomain: (domain) => set({ domain }),
  setUserEmail: (email) => {
    const isPersonal = isPersonalEmailDomain(email);
    set({
      userEmail: email,
      isPersonalEmail: isPersonal,
      // If personal email, start at website_input step
      currentStep: isPersonal ? 'website_input' : 'enrichment_loading',
    });
  },

  // Step management
  setStep: (step) => set({ currentStep: step }),
  setCurrentSkillIndex: (index) => set({ currentSkillIndex: index }),

  // Website input actions
  setWebsiteUrl: (url) => set({ websiteUrl: url }),
  setHasNoWebsite: (value) => set({ hasNoWebsite: value }),

  submitWebsite: async (organizationId) => {
    const { websiteUrl } = get();
    if (!websiteUrl) return;

    const domain = extractDomain(websiteUrl);
    set({
      domain,
      enrichmentSource: 'website',
      currentStep: 'enrichment_loading',
    });

    // Start enrichment with the provided website
    get().startEnrichment(organizationId, domain);
  },

  // Manual enrichment actions
  setManualData: (data) => set({ manualData: data }),

  submitManualEnrichment: async (organizationId) => {
    const { manualData } = get();
    if (!manualData) return;

    set({
      isEnrichmentLoading: true,
      enrichmentError: null,
      enrichmentSource: 'manual',
      currentStep: 'enrichment_loading',
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call edge function with manual data
      const response = await supabase.functions.invoke('deep-enrich-organization', {
        body: {
          action: 'manual',
          organization_id: organizationId,
          manual_data: manualData,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to process data');

      // Start polling for status (manual enrichment still runs AI skill generation)
      get().pollEnrichmentStatus(organizationId);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process your information';
      set({ isEnrichmentLoading: false, enrichmentError: message });
    }
  },

  // Start enrichment (website-based)
  startEnrichment: async (organizationId, domain) => {
    set({ isEnrichmentLoading: true, enrichmentError: null, enrichmentSource: 'website' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('deep-enrich-organization', {
        body: {
          action: 'start',
          organization_id: organizationId,
          domain: domain,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to start enrichment');

      // Start polling for status
      get().pollEnrichmentStatus(organizationId);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start enrichment';
      set({ isEnrichmentLoading: false, enrichmentError: message });
    }
  },

  // Poll enrichment status
  pollEnrichmentStatus: async (organizationId) => {
    const poll = async () => {
      try {
        const response = await supabase.functions.invoke('deep-enrich-organization', {
          body: {
            action: 'status',
            organization_id: organizationId,
          },
        });

        if (response.error) throw response.error;

        const { status, enrichment, skills } = response.data;

        if (status === 'completed' && enrichment) {
          // Load skills into state
          const generatedSkills = enrichment.generated_skills || defaultSkillConfigs;

          set({
            enrichment,
            skillConfigs: generatedSkills,
            isEnrichmentLoading: false,
            currentStep: 'enrichment_result',
          });
          return;
        }

        if (status === 'failed') {
          set({
            isEnrichmentLoading: false,
            enrichmentError: enrichment?.error_message || 'Enrichment failed',
          });
          return;
        }

        // Update enrichment data for progressive display
        if (enrichment) {
          set({ enrichment });
        }

        // Continue polling
        setTimeout(() => get().pollEnrichmentStatus(organizationId), 2000);

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get status';
        set({ isEnrichmentLoading: false, enrichmentError: message });
      }
    };

    poll();
  },

  // Set enrichment directly (for testing/simulator)
  setEnrichment: (data) => {
    set({
      enrichment: data,
      skillConfigs: data.generated_skills || defaultSkillConfigs,
    });
  },

  // Update skill config
  updateSkillConfig: (skillId, config) => {
    set((state) => ({
      skillConfigs: {
        ...state.skillConfigs,
        [skillId]: config,
      },
    }));
  },

  // Mark skill as configured
  markSkillConfigured: (skillId) => {
    set((state) => ({
      configuredSkills: state.configuredSkills.includes(skillId)
        ? state.configuredSkills
        : [...state.configuredSkills, skillId],
      skippedSkills: state.skippedSkills.filter((id) => id !== skillId),
    }));
  },

  // Mark skill as skipped
  markSkillSkipped: (skillId) => {
    set((state) => ({
      skippedSkills: state.skippedSkills.includes(skillId)
        ? state.skippedSkills
        : [...state.skippedSkills, skillId],
      configuredSkills: state.configuredSkills.filter((id) => id !== skillId),
    }));
  },

  // Reset skill to AI default
  resetSkillConfig: (skillId) => {
    const { enrichment } = get();
    if (enrichment?.generated_skills?.[skillId]) {
      set((state) => ({
        skillConfigs: {
          ...state.skillConfigs,
          [skillId]: enrichment.generated_skills![skillId],
        },
      }));
    }
  },

  // Save all skills
  saveAllSkills: async (organizationId) => {
    set({ isSaving: true, saveError: null });

    try {
      const { skillConfigs, configuredSkills } = get();

      // Prepare skills array
      const skills = SKILLS.map((skill) => ({
        skill_id: skill.id,
        skill_name: skill.name,
        config: skillConfigs[skill.id],
      }));

      const response = await supabase.functions.invoke('save-organization-skills', {
        body: {
          action: 'save-all',
          organization_id: organizationId,
          skills,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to save skills');

      set({ isSaving: false, currentStep: 'complete' });
      return true;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save skills';
      set({ isSaving: false, saveError: message });
      return false;
    }
  },

  // Reset store
  reset: () => {
    set({
      // Context
      organizationId: null,
      domain: null,
      userEmail: null,
      isPersonalEmail: false,
      // Steps
      currentStep: 'enrichment_loading',
      currentSkillIndex: 0,
      // Website input
      websiteUrl: null,
      hasNoWebsite: false,
      // Manual enrichment
      manualData: null,
      // Enrichment
      enrichment: null,
      isEnrichmentLoading: false,
      enrichmentError: null,
      enrichmentSource: null,
      // Skills
      skillConfigs: defaultSkillConfigs,
      configuredSkills: [],
      skippedSkills: [],
      // Saving
      isSaving: false,
      saveError: null,
    });
  },
}));
