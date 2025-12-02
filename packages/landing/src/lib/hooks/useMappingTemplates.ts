/**
 * useMappingTemplates - Hook for managing CSV mapping templates
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { MappingTemplate, MappingTemplateInsert } from '@/lib/types/csvImport';

interface UseMappingTemplatesReturn {
  templates: MappingTemplate[];
  isLoading: boolean;
  error: Error | null;
  saveTemplate: (template: MappingTemplateInsert) => Promise<MappingTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  updateTemplateUsage: (templateId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// Helper to access the table with proper typing (table not in generated types yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTemplatesTable = () => (supabase as any).from('csv_mapping_templates');

export function useMappingTemplates(): UseMappingTemplatesReturn {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await getTemplatesTable()
        .select('*')
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTemplates((data as MappingTemplate[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch templates'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Save a new template
  const saveTemplate = useCallback(
    async (template: MappingTemplateInsert): Promise<MappingTemplate> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to save templates');
      }

      // Check if template with same name exists
      const existing = templates.find(
        (t) => t.name.toLowerCase() === template.name.toLowerCase()
      );

      if (existing) {
        // Update existing template
        const { data, error: updateError } = await getTemplatesTable()
          .update({
            column_mappings: template.column_mappings,
            description: template.description,
            source_hint: template.source_hint,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        if (!data) throw new Error('Failed to update template');

        // Update local state
        setTemplates((prev) =>
          prev.map((t) => (t.id === existing.id ? (data as MappingTemplate) : t))
        );

        return data as MappingTemplate;
      }

      // Create new template
      const { data, error: insertError } = await getTemplatesTable()
        .insert({
          user_id: user.id,
          name: template.name,
          description: template.description,
          column_mappings: template.column_mappings,
          source_hint: template.source_hint,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error('Failed to save template');

      // Update local state
      setTemplates((prev) => [data as MappingTemplate, ...prev]);

      return data as MappingTemplate;
    },
    [templates]
  );

  // Delete a template
  const deleteTemplate = useCallback(async (templateId: string): Promise<void> => {
    const { error: deleteError } = await getTemplatesTable()
      .delete()
      .eq('id', templateId);

    if (deleteError) throw deleteError;

    // Update local state
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  // Update usage count and last_used_at
  const updateTemplateUsage = useCallback(async (templateId: string): Promise<void> => {
    // Get current template to increment usage count
    const template = templates.find(t => t.id === templateId);
    const newUsageCount = template ? template.usage_count + 1 : 1;

    const { error: updateError } = await getTemplatesTable()
      .update({
        usage_count: newUsageCount,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (updateError) {
      // Non-critical error, just log it
      console.warn('Failed to update template usage:', updateError);
    }

    // Optimistically update local state
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              usage_count: newUsageCount,
              last_used_at: new Date().toISOString(),
            }
          : t
      )
    );
  }, [templates]);

  return {
    templates,
    isLoading,
    error,
    saveTemplate,
    deleteTemplate,
    updateTemplateUsage,
    refetch: fetchTemplates,
  };
}
