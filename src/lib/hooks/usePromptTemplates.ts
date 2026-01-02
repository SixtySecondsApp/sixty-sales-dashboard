/**
 * usePromptTemplates Hook
 *
 * React hook for managing AI prompt templates in the admin UI.
 * Provides access to default and customized prompts with CRUD operations.
 *
 * @see /src/lib/services/promptService.ts for underlying service
 * @see /src/pages/admin/PromptSettings.tsx for usage
 */

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import {
  loadPrompt,
  getAllPromptTemplates,
  getDefaultTemplate,
  saveUserPrompt,
  resetPromptToDefault,
  getUserPrompts,
  clearPromptCache,
  type LoadedPrompt,
  type DBPromptTemplate,
} from '@/lib/services/promptService';
import type { PromptTemplate, ModelConfig } from '@/lib/prompts';

// ============================================================================
// Types
// ============================================================================

export interface PromptTemplateInfo {
  featureKey: string;
  name: string;
  description: string;
  hasCustomization: boolean;
  source: 'default' | 'database';
}

export interface SelectedPromptInfo {
  template: PromptTemplate;
  modelConfig: ModelConfig;
  source: 'default' | 'database';
  dbId?: string;
}

export interface PromptCustomizationData {
  name: string;
  description?: string;
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface UsePromptTemplatesReturn {
  /** List of all available prompt templates with customization status */
  templates: PromptTemplateInfo[];

  /** Map of user customizations by feature key */
  userCustomizations: Record<string, DBPromptTemplate>;

  /** Currently selected/loaded prompt */
  selectedPrompt: SelectedPromptInfo | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Load a specific template by feature key */
  loadTemplate: (featureKey: string) => Promise<void>;

  /** Save a customization for a prompt */
  saveCustomization: (
    featureKey: string,
    data: PromptCustomizationData
  ) => Promise<void>;

  /** Reset a prompt to its default state */
  resetToDefault: (featureKey: string) => Promise<void>;

  /** Refresh the list of templates */
  refreshTemplates: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePromptTemplates(): UsePromptTemplatesReturn {
  const { userData } = useUser();
  const userId = userData?.id;

  // State
  const [templates, setTemplates] = useState<PromptTemplateInfo[]>([]);
  const [userCustomizations, setUserCustomizations] = useState<
    Record<string, DBPromptTemplate>
  >({});
  const [selectedPrompt, setSelectedPrompt] =
    useState<SelectedPromptInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Load Templates List
  // ============================================================================

  const refreshTemplates = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get all templates with customization status
      const allTemplates = await getAllPromptTemplates(userId);
      setTemplates(allTemplates);

      // Get user's customizations for quick lookup
      const customizations = await getUserPrompts(userId);
      const customizationMap: Record<string, DBPromptTemplate> = {};
      customizations.forEach((c) => {
        if (c.category) {
          customizationMap[c.category] = c;
        }
      });
      setUserCustomizations(customizationMap);
    } catch (err) {
      console.error('Failed to load prompt templates:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load templates'
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load templates on mount and when user changes
  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  // ============================================================================
  // Load Single Template
  // ============================================================================

  const loadTemplate = useCallback(
    async (featureKey: string) => {
      if (!userId) return;

      setIsLoading(true);
      setError(null);

      try {
        const loaded = await loadPrompt(featureKey, userId, true); // Skip cache for fresh data
        setSelectedPrompt(loaded);
      } catch (err) {
        console.error(`Failed to load template ${featureKey}:`, err);
        setError(
          err instanceof Error ? err.message : 'Failed to load template'
        );
        setSelectedPrompt(null);
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  // ============================================================================
  // Save Customization
  // ============================================================================

  const saveCustomization = useCallback(
    async (featureKey: string, data: PromptCustomizationData) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      try {
        // Get the default template for variables
        const defaultTemplate = getDefaultTemplate(featureKey);
        const variables = defaultTemplate?.variables || [];

        await saveUserPrompt(userId, featureKey, {
          name: data.name,
          description: data.description,
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          variables,
        });

        // Clear cache and refresh
        clearPromptCache(featureKey, userId);
        await refreshTemplates();

        // Reload the selected template to show updated data
        await loadTemplate(featureKey);
      } catch (err) {
        console.error(`Failed to save customization for ${featureKey}:`, err);
        throw err;
      }
    },
    [userId, refreshTemplates, loadTemplate]
  );

  // ============================================================================
  // Reset to Default
  // ============================================================================

  const resetToDefault = useCallback(
    async (featureKey: string) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      try {
        await resetPromptToDefault(userId, featureKey);

        // Clear cache and refresh
        clearPromptCache(featureKey, userId);
        await refreshTemplates();

        // Reload the template to show default
        await loadTemplate(featureKey);
      } catch (err) {
        console.error(`Failed to reset ${featureKey} to default:`, err);
        throw err;
      }
    },
    [userId, refreshTemplates, loadTemplate]
  );

  // ============================================================================
  // Return Hook Value
  // ============================================================================

  return {
    templates,
    userCustomizations,
    selectedPrompt,
    isLoading,
    error,
    loadTemplate,
    saveCustomization,
    resetToDefault,
    refreshTemplates,
  };
}

// Re-export the getDefaultTemplate for use in components
export { getDefaultTemplate } from '@/lib/services/promptService';
