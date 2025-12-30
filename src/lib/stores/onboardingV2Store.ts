/**
 * Onboarding V2 Store
 *
 * Manages state for the skills-based onboarding flow including:
 * - Enrichment data from AI analysis
 * - Skill configurations (AI-generated and user-modified)
 * - Step navigation and progress
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/clientV2';

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

export type OnboardingV2Step = 'enrichment_loading' | 'enrichment_result' | 'skills_config' | 'complete';

interface OnboardingV2State {
  // Step management
  currentStep: OnboardingV2Step;
  currentSkillIndex: number;

  // Enrichment data
  enrichment: EnrichmentData | null;
  isEnrichmentLoading: boolean;
  enrichmentError: string | null;

  // Skill configurations
  skillConfigs: SkillConfigs;
  configuredSkills: SkillId[];
  skippedSkills: SkillId[];

  // Saving state
  isSaving: boolean;
  saveError: string | null;

  // Actions
  setStep: (step: OnboardingV2Step) => void;
  setCurrentSkillIndex: (index: number) => void;

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

export const useOnboardingV2Store = create<OnboardingV2State>((set, get) => ({
  // Initial state
  currentStep: 'enrichment_loading',
  currentSkillIndex: 0,
  enrichment: null,
  isEnrichmentLoading: false,
  enrichmentError: null,
  skillConfigs: defaultSkillConfigs,
  configuredSkills: [],
  skippedSkills: [],
  isSaving: false,
  saveError: null,

  // Step management
  setStep: (step) => set({ currentStep: step }),
  setCurrentSkillIndex: (index) => set({ currentSkillIndex: index }),

  // Start enrichment
  startEnrichment: async (organizationId, domain) => {
    set({ isEnrichmentLoading: true, enrichmentError: null });

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
      currentStep: 'enrichment_loading',
      currentSkillIndex: 0,
      enrichment: null,
      isEnrichmentLoading: false,
      enrichmentError: null,
      skillConfigs: defaultSkillConfigs,
      configuredSkills: [],
      skippedSkills: [],
      isSaving: false,
      saveError: null,
    });
  },
}));
