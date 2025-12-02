/**
 * useEmailTemplates Hook
 * React Query hook for email template management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEmailTemplates,
  getEmailTemplate,
  getDefaultTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  setDefaultTemplate,
  previewTemplate,
  type EmailTemplate,
  type TemplateType,
  type TemplateVariables,
} from '@/lib/services/emailTemplateService';

const QUERY_KEYS = {
  templates: ['email-templates'] as const,
  template: (id: string) => ['email-template', id] as const,
  templatesByType: (type: TemplateType) => ['email-templates', type] as const,
  defaultTemplate: (type: TemplateType) => ['email-template', 'default', type] as const,
  preview: (id: string) => ['email-template', 'preview', id] as const,
};

/**
 * Fetch all email templates
 */
export function useEmailTemplates(type?: TemplateType) {
  return useQuery({
    queryKey: type ? QUERY_KEYS.templatesByType(type) : QUERY_KEYS.templates,
    queryFn: async () => {
      const result = await getEmailTemplates(type);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch templates');
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single email template by ID
 */
export function useEmailTemplate(templateId: string | null) {
  return useQuery({
    queryKey: templateId ? QUERY_KEYS.template(templateId) : ['email-template', 'null'],
    queryFn: async () => {
      if (!templateId) return null;
      const result = await getEmailTemplate(templateId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch template');
      }
      return result.data;
    },
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch the default template for a type
 */
export function useDefaultEmailTemplate(type: TemplateType) {
  return useQuery({
    queryKey: QUERY_KEYS.defaultTemplate(type),
    queryFn: async () => {
      const result = await getDefaultTemplate(type);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch default template');
      }
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (defaults change rarely)
  });
}

/**
 * Preview a template with sample data
 */
export function useEmailTemplatePreview(
  templateId: string | null,
  sampleData?: TemplateVariables
) {
  return useQuery({
    queryKey: templateId ? [...QUERY_KEYS.preview(templateId), sampleData] : ['preview', 'null'],
    queryFn: async () => {
      if (!templateId) return null;
      const result = await previewTemplate(templateId, sampleData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to preview template');
      }
      return result.data;
    },
    enabled: !!templateId,
    staleTime: 0, // Always fresh for preview
  });
}

/**
 * Create a new email template
 */
export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>;
      userId: string;
    }) => {
      const result = await createEmailTemplate(params.template, params.userId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create template');
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templates });
      if (data) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templatesByType(data.template_type) });
      }
    },
  });
}

/**
 * Update an existing email template
 */
export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      templateId: string;
      updates: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
    }) => {
      const result = await updateEmailTemplate(params.templateId, params.updates);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update template');
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.template(variables.templateId) });
      if (data) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templatesByType(data.template_type) });
      }
    },
  });
}

/**
 * Delete an email template (soft delete)
 */
export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const result = await deleteEmailTemplate(templateId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete template');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all template queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templates });
    },
  });
}

/**
 * Set a template as the default for its type
 */
export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { templateId: string; type: TemplateType }) => {
      const result = await setDefaultTemplate(params.templateId, params.type);
      if (!result.success) {
        throw new Error(result.error || 'Failed to set default template');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templatesByType(variables.type) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultTemplate(variables.type) });
    },
  });
}

/**
 * Combined hook for all template operations
 */
export function useEmailTemplateOperations(userId: string) {
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();
  const deleteMutation = useDeleteEmailTemplate();
  const setDefaultMutation = useSetDefaultTemplate();

  return {
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    setDefault: setDefaultMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSettingDefault: setDefaultMutation.isPending,
    isProcessing:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      setDefaultMutation.isPending,
  };
}
