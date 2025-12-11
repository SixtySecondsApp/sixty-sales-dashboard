/**
 * Encharge Template Service
 * 
 * Manages email templates stored in Supabase
 * No Encharge UI required - everything managed programmatically
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface EnchargeEmailTemplate {
  id: string;
  template_name: string;
  template_type: string;
  subject_line: string;
  html_body: string;
  text_body?: string;
  variables: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateParams {
  template_name: string;
  template_type: string;
  subject_line: string;
  html_body: string;
  text_body?: string;
  variables?: Record<string, string>;
}

/**
 * Get all active templates
 */
export async function getAllTemplates(): Promise<EnchargeEmailTemplate[]> {
  const { data, error } = await supabase
    .from('encharge_email_templates')
    .select('*')
    .eq('is_active', true)
    .order('template_type', { ascending: true });

  if (error) {
    console.error('[enchargeTemplateService] Error fetching templates:', error);
    return [];
  }

  return data || [];
}

/**
 * Get template by type
 */
export async function getTemplateByType(
  templateType: string
): Promise<EnchargeEmailTemplate | null> {
  const { data, error } = await supabase
    .from('encharge_email_templates')
    .select('*')
    .eq('template_type', templateType)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[enchargeTemplateService] Error fetching template:', error);
    return null;
  }

  return data;
}

/**
 * Get template by name
 */
export async function getTemplateByName(
  templateName: string
): Promise<EnchargeEmailTemplate | null> {
  const { data, error } = await supabase
    .from('encharge_email_templates')
    .select('*')
    .eq('template_name', templateName)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[enchargeTemplateService] Error fetching template:', error);
    return null;
  }

  return data;
}

/**
 * Create a new template (admin only)
 */
export async function createTemplate(
  params: CreateTemplateParams
): Promise<{ success: boolean; template?: EnchargeEmailTemplate; error?: string }> {
  const { data, error } = await supabase
    .from('encharge_email_templates')
    .insert({
      template_name: params.template_name,
      template_type: params.template_type,
      subject_line: params.subject_line,
      html_body: params.html_body,
      text_body: params.text_body,
      variables: params.variables || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[enchargeTemplateService] Error creating template:', error);
    return { success: false, error: error.message };
  }

  return { success: true, template: data };
}

/**
 * Update an existing template (admin only)
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<CreateTemplateParams>
): Promise<{ success: boolean; template?: EnchargeEmailTemplate; error?: string }> {
  const { data, error } = await supabase
    .from('encharge_email_templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    console.error('[enchargeTemplateService] Error updating template:', error);
    return { success: false, error: error.message };
  }

  return { success: true, template: data };
}

/**
 * Delete a template (admin only)
 */
export async function deleteTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('encharge_email_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('[enchargeTemplateService] Error deleting template:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Send email using template
 */
export async function sendEmailWithTemplate(params: {
  template_type: string;
  to_email: string;
  to_name?: string;
  user_id?: string;
  variables?: Record<string, any>;
}): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('encharge-send-email', {
      body: params,
    });

    if (error) {
      console.error('[enchargeTemplateService] Error sending email:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return data as { success: boolean; message_id?: string; error?: string };
  } catch (err) {
    console.error('[enchargeTemplateService] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export default {
  getAllTemplates,
  getTemplateByType,
  getTemplateByName,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendEmailWithTemplate,
};
