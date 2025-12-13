/**
 * Org Proposal Workflow Service
 * Manages organization-level custom proposal workflow configurations
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface OrgProposalWorkflow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  include_goals: boolean;
  include_sow: boolean;
  include_html: boolean;
  include_email: boolean;
  include_formatted: boolean;
  include_markdown: boolean;
  is_active: boolean;
  display_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateProposalWorkflowInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  include_goals?: boolean;
  include_sow?: boolean;
  include_html?: boolean;
  include_email?: boolean;
  include_formatted?: boolean;
  include_markdown?: boolean;
  is_default?: boolean;
}

export interface UpdateProposalWorkflowInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  include_goals?: boolean;
  include_sow?: boolean;
  include_html?: boolean;
  include_email?: boolean;
  include_formatted?: boolean;
  include_markdown?: boolean;
  is_active?: boolean;
  display_order?: number;
  is_default?: boolean;
}

// Helper to get human-readable output types for a workflow
export function getWorkflowOutputTypes(workflow: OrgProposalWorkflow): string[] {
  const outputs: string[] = [];
  if (workflow.include_goals) outputs.push('Goals');
  if (workflow.include_sow) outputs.push('SOW');
  if (workflow.include_html) outputs.push('HTML');
  if (workflow.include_email) outputs.push('Email');
  if (workflow.include_formatted) outputs.push('Formatted');
  if (workflow.include_markdown) outputs.push('Markdown');
  return outputs;
}

// Helper to get output type count
export function getWorkflowOutputCount(workflow: OrgProposalWorkflow): number {
  return [
    workflow.include_goals,
    workflow.include_sow,
    workflow.include_html,
    workflow.include_email,
    workflow.include_formatted,
    workflow.include_markdown,
  ].filter(Boolean).length;
}

export class OrgProposalWorkflowService {
  /**
   * Get all proposal workflows for an organization
   */
  static async getWorkflows(orgId: string): Promise<OrgProposalWorkflow[]> {
    try {
      const { data, error } = await supabase
        .from('org_proposal_workflows')
        .select('*')
        .eq('org_id', orgId)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as OrgProposalWorkflow[];
    } catch (error) {
      console.error('Error fetching proposal workflows:', error);
      throw error;
    }
  }

  /**
   * Get active proposal workflows for an organization
   */
  static async getActiveWorkflows(orgId: string): Promise<OrgProposalWorkflow[]> {
    try {
      const { data, error } = await supabase
        .from('org_proposal_workflows')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as OrgProposalWorkflow[];
    } catch (error) {
      console.error('Error fetching active proposal workflows:', error);
      throw error;
    }
  }

  /**
   * Get a specific workflow by ID
   */
  static async getWorkflow(orgId: string, workflowId: string): Promise<OrgProposalWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('org_proposal_workflows')
        .select('*')
        .eq('org_id', orgId)
        .eq('id', workflowId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data as OrgProposalWorkflow;
    } catch (error) {
      console.error('Error fetching proposal workflow:', error);
      throw error;
    }
  }

  /**
   * Get the default workflow for an organization
   */
  static async getDefaultWorkflow(orgId: string): Promise<OrgProposalWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('org_proposal_workflows')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data as OrgProposalWorkflow;
    } catch (error) {
      console.error('Error fetching default proposal workflow:', error);
      throw error;
    }
  }

  /**
   * Create a new proposal workflow
   */
  static async createWorkflow(
    orgId: string,
    input: CreateProposalWorkflowInput,
    userId?: string
  ): Promise<OrgProposalWorkflow> {
    try {
      // Validate that at least one output type is selected
      const hasOutput = input.include_goals || input.include_sow || input.include_html ||
                       input.include_email || input.include_formatted || input.include_markdown;
      if (!hasOutput) {
        throw new Error('At least one output type must be selected');
      }

      // Get the next display order
      const { data: existingWorkflows } = await supabase
        .from('org_proposal_workflows')
        .select('display_order')
        .eq('org_id', orgId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = existingWorkflows?.[0]?.display_order
        ? existingWorkflows[0].display_order + 1
        : 1;

      // If this is being set as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('org_proposal_workflows')
          .update({ is_default: false })
          .eq('org_id', orgId);
      }

      const { data, error } = await supabase
        .from('org_proposal_workflows')
        .insert({
          org_id: orgId,
          name: input.name,
          description: input.description || null,
          icon: input.icon || 'file-text',
          color: input.color || 'blue',
          include_goals: input.include_goals || false,
          include_sow: input.include_sow || false,
          include_html: input.include_html || false,
          include_email: input.include_email || false,
          include_formatted: input.include_formatted || false,
          include_markdown: input.include_markdown || false,
          is_default: input.is_default || false,
          display_order: nextOrder,
          created_by: userId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OrgProposalWorkflow;
    } catch (error) {
      console.error('Error creating proposal workflow:', error);
      throw error;
    }
  }

  /**
   * Update an existing proposal workflow
   */
  static async updateWorkflow(
    orgId: string,
    workflowId: string,
    input: UpdateProposalWorkflowInput
  ): Promise<OrgProposalWorkflow> {
    try {
      // If updating output types, validate at least one is selected
      if (
        input.include_goals !== undefined ||
        input.include_sow !== undefined ||
        input.include_html !== undefined ||
        input.include_email !== undefined ||
        input.include_formatted !== undefined ||
        input.include_markdown !== undefined
      ) {
        const existing = await this.getWorkflow(orgId, workflowId);
        if (!existing) throw new Error('Workflow not found');

        const newGoals = input.include_goals ?? existing.include_goals;
        const newSow = input.include_sow ?? existing.include_sow;
        const newHtml = input.include_html ?? existing.include_html;
        const newEmail = input.include_email ?? existing.include_email;
        const newFormatted = input.include_formatted ?? existing.include_formatted;
        const newMarkdown = input.include_markdown ?? existing.include_markdown;

        if (!newGoals && !newSow && !newHtml && !newEmail && !newFormatted && !newMarkdown) {
          throw new Error('At least one output type must be selected');
        }
      }

      // If setting as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('org_proposal_workflows')
          .update({ is_default: false })
          .eq('org_id', orgId)
          .neq('id', workflowId);
      }

      const { data, error } = await supabase
        .from('org_proposal_workflows')
        .update(input)
        .eq('org_id', orgId)
        .eq('id', workflowId)
        .select()
        .single();

      if (error) throw error;
      return data as OrgProposalWorkflow;
    } catch (error) {
      console.error('Error updating proposal workflow:', error);
      throw error;
    }
  }

  /**
   * Delete a proposal workflow
   */
  static async deleteWorkflow(orgId: string, workflowId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('org_proposal_workflows')
        .delete()
        .eq('org_id', orgId)
        .eq('id', workflowId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting proposal workflow:', error);
      throw error;
    }
  }

  /**
   * Reorder workflows by providing an array of workflow IDs in desired order
   */
  static async reorderWorkflows(orgId: string, workflowIds: string[]): Promise<void> {
    try {
      const updates = workflowIds.map((id, index) => ({
        id,
        org_id: orgId,
        display_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('org_proposal_workflows')
          .update({ display_order: update.display_order })
          .eq('org_id', orgId)
          .eq('id', update.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error reordering proposal workflows:', error);
      throw error;
    }
  }

  /**
   * Duplicate an existing workflow with a new name
   */
  static async duplicateWorkflow(
    orgId: string,
    workflowId: string,
    newName: string,
    userId?: string
  ): Promise<OrgProposalWorkflow> {
    try {
      const existing = await this.getWorkflow(orgId, workflowId);
      if (!existing) throw new Error('Workflow not found');

      return await this.createWorkflow(
        orgId,
        {
          name: newName,
          description: existing.description || undefined,
          icon: existing.icon,
          color: existing.color,
          include_goals: existing.include_goals,
          include_sow: existing.include_sow,
          include_html: existing.include_html,
          include_email: existing.include_email,
          include_formatted: existing.include_formatted,
          include_markdown: existing.include_markdown,
          is_default: false, // Never duplicate as default
        },
        userId
      );
    } catch (error) {
      console.error('Error duplicating proposal workflow:', error);
      throw error;
    }
  }
}
