/**
 * usePromptTemplates Hook
 *
 * React hook for managing AI prompt templates.
 * Provides CRUD operations for user prompt customizations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  loadPrompt,
  saveUserPrompt,
  getUserPrompts,
  deleteUserPrompt,
  getAllPromptTemplates,
  getDefaultTemplate,
  clearPromptCache,
  type DBPromptTemplate,
  type LoadedPrompt,
} from '@/lib/services/promptService';

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

export interface UsePromptTemplatesReturn {
  // Data
  templates: PromptTemplateInfo[];
  userCustomizations: DBPromptTemplate[];
  selectedPrompt: LoadedPrompt | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTemplate: (featureKey: string) => Promise<void>;
  saveCustomization: (
    featureKey: string,
    data: {
      name: string;
      description?: string;
      systemPrompt: string;
      userPrompt: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ) => Promise<void>;
  resetToDefault: (featureKey: string) => Promise<void>;
  refreshTemplates: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePromptTemplates(): UsePromptTemplatesReturn {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PromptTemplateInfo[]>([]);
  const [userCustomizations, setUserCustomizations] = useState<DBPromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<LoadedPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all templates on mount
  const refreshTemplates = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [allTemplates, customizations] = await Promise.all([
        getAllPromptTemplates(user.id),
        getUserPrompts(user.id),
      ]);

      setTemplates(allTemplates);
      setUserCustomizations(customizations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  // Load a specific template
  const loadTemplate = useCallback(
    async (featureKey: string) => {
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loaded = await loadPrompt(featureKey, user.id, true);
        setSelectedPrompt(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
        setSelectedPrompt(null);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id]
  );

  // Save a customization
  const saveCustomization = useCallback(
    async (
      featureKey: string,
      data: {
        name: string;
        description?: string;
        systemPrompt: string;
        userPrompt: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
      }
    ) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      setIsLoading(true);
      setError(null);

      try {
        await saveUserPrompt(user.id, featureKey, data);
        clearPromptCache(featureKey, user.id);
        await refreshTemplates();

        // Reload the template to get updated data
        const loaded = await loadPrompt(featureKey, user.id, true);
        setSelectedPrompt(loaded);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save customization';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, refreshTemplates]
  );

  // Reset to default
  const resetToDefault = useCallback(
    async (featureKey: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      setIsLoading(true);
      setError(null);

      try {
        await deleteUserPrompt(user.id, featureKey);
        clearPromptCache(featureKey, user.id);
        await refreshTemplates();

        // Reload to show default
        const loaded = await loadPrompt(featureKey, user.id, true);
        setSelectedPrompt(loaded);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reset template';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, refreshTemplates]
  );

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

// ============================================================================
// Utility Hook for Single Prompt
// ============================================================================

export function usePromptTemplate(featureKey: string) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState<LoadedPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!featureKey) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loaded = await loadPrompt(featureKey, user?.id);
        setPrompt(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prompt');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [featureKey, user?.id]);

  const refresh = useCallback(async () => {
    if (!featureKey) return;

    setIsLoading(true);
    try {
      clearPromptCache(featureKey, user?.id);
      const loaded = await loadPrompt(featureKey, user?.id, true);
      setPrompt(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prompt');
    } finally {
      setIsLoading(false);
    }
  }, [featureKey, user?.id]);

  return { prompt, isLoading, error, refresh };
}
