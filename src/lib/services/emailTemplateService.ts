/**
 * Waitlist Email Template Service
 * Manages customizable email templates for waitlist invitations and user communications
 * Table: waitlist_email_templates (renamed to avoid conflict with MCP email_templates)
 */

import { supabase } from '../supabase';

export type TemplateType = 'access_grant' | 'reminder' | 'welcome';

export interface EmailTemplate {
  id: string;
  template_name: string;
  template_type: TemplateType;
  description?: string;
  subject_line: string;
  email_body: string; // HTML with {{placeholders}}
  is_default: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariables {
  user_name?: string;
  user_email?: string;
  company_name?: string;
  referral_code?: string;
  waitlist_position?: number;
  magic_link?: string;
  admin_name?: string;
  custom_message?: string;
  current_date?: string;
  expiry_date?: string;
  days_remaining?: number;
  [key: string]: any;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get all email templates, optionally filtered by type
 */
export async function getEmailTemplates(
  type?: TemplateType
): Promise<ServiceResult<EmailTemplate[]>> {
  try {
    let query = supabase
      .from('waitlist_email_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('template_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      data: data || [],
    };
  } catch (error: any) {
    console.error('Error fetching waitlist email templates:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch waitlist email templates',
    };
  }
}

/**
 * Get a single email template by ID
 */
export async function getEmailTemplate(
  templateId: string
): Promise<ServiceResult<EmailTemplate>> {
  try {
    const { data, error } = await supabase
      .from('waitlist_email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error fetching waitlist email template:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch waitlist email template',
    };
  }
}

/**
 * Get the default template for a specific type
 */
export async function getDefaultTemplate(
  type: TemplateType
): Promise<ServiceResult<EmailTemplate>> {
  try {
    const { data, error } = await supabase
      .from('waitlist_email_templates')
      .select('*')
      .eq('template_type', type)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error fetching default waitlist template:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch default waitlist template',
    };
  }
}

/**
 * Create a new waitlist email template
 */
export async function createEmailTemplate(
  template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<ServiceResult<EmailTemplate>> {
  try {
    const { data, error } = await supabase
      .from('waitlist_email_templates')
      .insert({
        ...template,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error creating waitlist email template:', error);
    return {
      success: false,
      error: error.message || 'Failed to create waitlist email template',
    };
  }
}

/**
 * Update an existing waitlist email template
 */
export async function updateEmailTemplate(
  templateId: string,
  updates: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>>
): Promise<ServiceResult<EmailTemplate>> {
  try {
    const { data, error } = await supabase
      .from('waitlist_email_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error updating waitlist email template:', error);
    return {
      success: false,
      error: error.message || 'Failed to update waitlist email template',
    };
  }
}

/**
 * Delete a waitlist email template (soft delete by setting is_active to false)
 */
export async function deleteEmailTemplate(
  templateId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('waitlist_email_templates')
      .update({ is_active: false })
      .eq('id', templateId);

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error deleting waitlist email template:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete waitlist email template',
    };
  }
}

/**
 * Set a template as the default for its type
 * This will unset any other default templates of the same type
 */
export async function setDefaultTemplate(
  templateId: string,
  type: TemplateType
): Promise<ServiceResult> {
  try {
    // First, unset all defaults for this type
    await supabase
      .from('waitlist_email_templates')
      .update({ is_default: false })
      .eq('template_type', type)
      .eq('is_default', true);

    // Then set the new default
    const { error } = await supabase
      .from('waitlist_email_templates')
      .update({ is_default: true })
      .eq('id', templateId);

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error setting default waitlist template:', error);
    return {
      success: false,
      error: error.message || 'Failed to set default waitlist template',
    };
  }
}

/**
 * Process template by replacing placeholders with actual values
 * Supports {{variable}} syntax
 */
export function processTemplate(
  template: string,
  variables: TemplateVariables
): string {
  let processed = template;

  // Handle conditional blocks: {{#if variable}}...{{/if}}
  const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(ifBlockRegex, (match, varName, content) => {
    return variables[varName] ? content : '';
  });

  // Replace all {{variable}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(placeholder, String(value ?? ''));
  });

  return processed;
}

/**
 * Preview a template with sample data
 */
export async function previewTemplate(
  templateId: string,
  sampleData?: TemplateVariables
): Promise<ServiceResult<{ subject: string; body: string }>> {
  try {
    const templateResult = await getEmailTemplate(templateId);

    if (!templateResult.success || !templateResult.data) {
      throw new Error(templateResult.error || 'Template not found');
    }

    const template = templateResult.data;

    // Default sample data
    const defaultSampleData: TemplateVariables = {
      user_name: 'John Doe',
      user_email: 'john.doe@example.com',
      company_name: 'Acme Corp',
      referral_code: 'JOHN123',
      waitlist_position: 42,
      magic_link: 'https://app.example.com/auth/callback?token=sample',
      admin_name: 'Support Team',
      custom_message: 'We\'re excited to have you join us!',
      current_date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      days_remaining: 7,
    };

    const variables = { ...defaultSampleData, ...sampleData };

    const processedSubject = processTemplate(template.subject_line, variables);
    const processedBody = processTemplate(template.email_body, variables);

    return {
      success: true,
      data: {
        subject: processedSubject,
        body: processedBody,
      },
    };
  } catch (error: any) {
    console.error('Error previewing template:', error);
    return {
      success: false,
      error: error.message || 'Failed to preview template',
    };
  }
}

/**
 * Validate template placeholders
 * Returns list of all placeholders found in the template
 */
export function extractPlaceholders(template: string): string[] {
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const matches = template.matchAll(placeholderRegex);
  const placeholders = new Set<string>();

  for (const match of matches) {
    placeholders.add(match[1]);
  }

  return Array.from(placeholders);
}

/**
 * Validate that all required placeholders have values
 */
export function validateTemplateVariables(
  template: string,
  variables: TemplateVariables,
  requiredVars: string[] = []
): { valid: boolean; missing: string[] } {
  const placeholders = extractPlaceholders(template);
  const missing: string[] = [];

  // Check required variables
  requiredVars.forEach((varName) => {
    if (!variables[varName]) {
      missing.push(varName);
    }
  });

  // Check all placeholders in template
  placeholders.forEach((placeholder) => {
    if (variables[placeholder] === undefined || variables[placeholder] === null) {
      if (!missing.includes(placeholder)) {
        missing.push(placeholder);
      }
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}
