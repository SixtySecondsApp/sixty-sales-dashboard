import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  toneSettingsService,
  type ToneSettings,
  type ToneSettingsInput,
  type AllToneSettings,
  DEFAULT_TONE_SETTINGS,
} from '@/lib/services/toneSettingsService';
import type { ContentType } from '@/lib/services/contentService';

// ============================================================================
// Query Keys
// ============================================================================

export const toneSettingsKeys = {
  all: ['tone-settings'] as const,
  list: () => [...toneSettingsKeys.all, 'list'] as const,
  byType: (contentType: ContentType) =>
    [...toneSettingsKeys.all, contentType] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all tone settings for the current user
 *
 * @example
 * ```tsx
 * const { data: allSettings, isLoading } = useAllToneSettings();
 * console.log(allSettings?.social?.tone_style);
 * ```
 */
export function useAllToneSettings(options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return useQuery({
    queryKey: toneSettingsKeys.list(),
    queryFn: () => toneSettingsService.getAllToneSettings(),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to fetch tone settings for a specific content type
 *
 * @param contentType - The content type to get settings for
 *
 * @example
 * ```tsx
 * const { data: socialSettings } = useToneSettings('social');
 * ```
 */
export function useToneSettings(
  contentType: ContentType,
  options?: {
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: toneSettingsKeys.byType(contentType),
    queryFn: () => toneSettingsService.getToneSettings(contentType),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to save tone settings with optimistic updates
 *
 * @example
 * ```tsx
 * const { mutate: saveSettings, isLoading } = useSaveToneSettings();
 *
 * saveSettings({
 *   content_type: 'social',
 *   tone_style: 'professional',
 *   formality_level: 6,
 * });
 * ```
 */
export function useSaveToneSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: ToneSettingsInput) =>
      toneSettingsService.saveToneSettings(settings),

    // Optimistic update
    onMutate: async (newSettings) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: toneSettingsKeys.all });

      // Snapshot previous value
      const previousAll = queryClient.getQueryData<AllToneSettings>(
        toneSettingsKeys.list()
      );
      const previousType = queryClient.getQueryData<ToneSettings>(
        toneSettingsKeys.byType(newSettings.content_type)
      );

      // Optimistically update both caches
      if (previousAll) {
        queryClient.setQueryData<AllToneSettings>(
          toneSettingsKeys.list(),
          {
            ...previousAll,
            [newSettings.content_type]: {
              ...DEFAULT_TONE_SETTINGS[newSettings.content_type],
              ...previousAll[newSettings.content_type],
              ...newSettings,
            },
          }
        );
      }

      queryClient.setQueryData<ToneSettings>(
        toneSettingsKeys.byType(newSettings.content_type),
        (old) => ({
          ...DEFAULT_TONE_SETTINGS[newSettings.content_type],
          ...old,
          ...newSettings,
        })
      );

      return { previousAll, previousType };
    },

    // On error, rollback
    onError: (_err, newSettings, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(
          toneSettingsKeys.list(),
          context.previousAll
        );
      }
      if (context?.previousType) {
        queryClient.setQueryData(
          toneSettingsKeys.byType(newSettings.content_type),
          context.previousType
        );
      }
    },

    // After success, invalidate and refetch
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: toneSettingsKeys.all });
    },
  });
}

/**
 * Hook to reset tone settings to defaults
 *
 * @example
 * ```tsx
 * const { mutate: resetSettings } = useResetToneSettings();
 * resetSettings('social'); // Reset social settings to defaults
 * ```
 */
export function useResetToneSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contentType: ContentType) =>
      toneSettingsService.resetToneSettings(contentType),

    onSuccess: (_, contentType) => {
      // Update cache with defaults
      queryClient.setQueryData<ToneSettings>(
        toneSettingsKeys.byType(contentType),
        DEFAULT_TONE_SETTINGS[contentType]
      );

      // Update all settings cache
      queryClient.setQueryData<AllToneSettings>(
        toneSettingsKeys.list(),
        (old) => ({
          ...old,
          [contentType]: DEFAULT_TONE_SETTINGS[contentType],
        })
      );
    },
  });
}

/**
 * Hook to reset all tone settings to defaults
 *
 * @example
 * ```tsx
 * const { mutate: resetAll } = useResetAllToneSettings();
 * resetAll();
 * ```
 */
export function useResetAllToneSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toneSettingsService.resetAllToneSettings(),

    onSuccess: () => {
      // Reset all caches to defaults
      queryClient.setQueryData<AllToneSettings>(
        toneSettingsKeys.list(),
        {
          social: DEFAULT_TONE_SETTINGS.social,
          blog: DEFAULT_TONE_SETTINGS.blog,
          email: DEFAULT_TONE_SETTINGS.email,
          video: DEFAULT_TONE_SETTINGS.video,
        }
      );

      // Also reset individual type caches
      (['social', 'blog', 'email', 'video'] as ContentType[]).forEach(
        (type) => {
          queryClient.setQueryData<ToneSettings>(
            toneSettingsKeys.byType(type),
            DEFAULT_TONE_SETTINGS[type]
          );
        }
      );
    },
  });
}

// ============================================================================
// Helper Hook for Form State
// ============================================================================

import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage tone settings form state
 *
 * @param contentType - The content type being edited
 *
 * @example
 * ```tsx
 * const {
 *   formState,
 *   setField,
 *   isDirty,
 *   resetForm,
 *   getSubmitData,
 * } = useToneSettingsForm('social');
 * ```
 */
export function useToneSettingsForm(contentType: ContentType) {
  const { data: savedSettings, isLoading } = useToneSettings(contentType);
  const { mutate: saveSettings, isPending: isSaving } = useSaveToneSettings();

  const [formState, setFormState] = useState<Partial<ToneSettings>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize form when data loads
  useEffect(() => {
    if (savedSettings && !isDirty) {
      setFormState(savedSettings);
    }
  }, [savedSettings, isDirty]);

  const setField = useCallback(<K extends keyof ToneSettings>(
    key: K,
    value: ToneSettings[K]
  ) => {
    setFormState(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const resetForm = useCallback(() => {
    if (savedSettings) {
      setFormState(savedSettings);
    } else {
      setFormState(DEFAULT_TONE_SETTINGS[contentType]);
    }
    setIsDirty(false);
  }, [savedSettings, contentType]);

  const getSubmitData = useCallback((): ToneSettingsInput => ({
    content_type: contentType,
    tone_style: formState.tone_style,
    formality_level: formState.formality_level,
    emoji_usage: formState.emoji_usage,
    brand_voice_description: formState.brand_voice_description,
    sample_phrases: formState.sample_phrases,
    words_to_avoid: formState.words_to_avoid,
    preferred_keywords: formState.preferred_keywords,
    max_length_override: formState.max_length_override,
    include_cta: formState.include_cta,
    cta_style: formState.cta_style,
  }), [contentType, formState]);

  const handleSubmit = useCallback(() => {
    const data = getSubmitData();
    saveSettings(data, {
      onSuccess: () => {
        setIsDirty(false);
      },
    });
  }, [saveSettings, getSubmitData]);

  return {
    formState,
    setField,
    isDirty,
    isLoading,
    isSaving,
    resetForm,
    getSubmitData,
    handleSubmit,
    // Common field setters
    setToneStyle: (value: string) => setField('tone_style', value),
    setFormalityLevel: (value: number) => setField('formality_level', value),
    setEmojiUsage: (value: ToneSettings['emoji_usage']) => setField('emoji_usage', value),
    setBrandVoice: (value: string) => setField('brand_voice_description', value),
    setSamplePhrases: (value: string[]) => setField('sample_phrases', value),
    setWordsToAvoid: (value: string[]) => setField('words_to_avoid', value),
    setPreferredKeywords: (value: string[]) => setField('preferred_keywords', value),
    setMaxLength: (value: number | undefined) => setField('max_length_override', value),
    setIncludeCTA: (value: boolean) => setField('include_cta', value),
    setCTAStyle: (value: ToneSettings['cta_style']) => setField('cta_style', value),
  };
}

// Re-export types and defaults for convenience
export { DEFAULT_TONE_SETTINGS };
export type { ToneSettings, ToneSettingsInput, AllToneSettings };
