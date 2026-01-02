import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AdapterRegistry } from './registry.ts';
import type { ActionResult, AdapterContext, ExecuteActionName, InvokeSkillParams, CreateTaskParams } from './types.ts';

type SupabaseClient = ReturnType<typeof createClient>;

// Maximum skill nesting depth to prevent infinite recursion
const MAX_INVOKE_DEPTH = 3;

export async function executeAction(
  client: SupabaseClient,
  userId: string,
  orgId: string | null,
  action: ExecuteActionName,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const confirm = params.confirm === true;
  const ctx: AdapterContext = { userId, orgId, confirm };

  const registry = new AdapterRegistry(client, userId);
  const adapters = await registry.forOrg(orgId);

  switch (action) {
    case 'get_contact':
      return adapters.crm.getContact({
        id: params.id ? String(params.id) : undefined,
        email: params.email ? String(params.email) : undefined,
        name: params.name ? String(params.name) : undefined,
      });

    case 'get_deal':
      return adapters.crm.getDeal({
        id: params.id ? String(params.id) : undefined,
        name: params.name ? String(params.name) : undefined,
      });

    case 'get_meetings':
      return adapters.meetings.listMeetings({
        contactEmail: params.contactEmail ? String(params.contactEmail) : undefined,
        contactId: params.contactId ? String(params.contactId) : undefined,
        limit: params.limit ? Number(params.limit) : undefined,
      });

    case 'search_emails':
      return adapters.email.searchEmails({
        contact_email: params.contact_email ? String(params.contact_email) : undefined,
        contact_id: params.contact_id ? String(params.contact_id) : undefined,
        contact_name: params.contact_name ? String(params.contact_name) : undefined,
        query: params.query ? String(params.query) : undefined,
        limit: params.limit ? Number(params.limit) : undefined,
      });

    case 'draft_email':
      return adapters.email.draftEmail({
        to: params.to ? String(params.to) : undefined,
        subject: params.subject ? String(params.subject) : undefined,
        context: params.context ? String(params.context) : undefined,
        tone: params.tone ? String(params.tone) : undefined,
      });

    case 'update_crm': {
      const entity = params.entity as 'deal' | 'contact' | 'task' | 'activity';
      const id = params.id ? String(params.id) : '';
      const updates = (params.updates || {}) as Record<string, unknown>;
      return adapters.crm.updateCRM({ entity, id, updates }, ctx);
    }

    case 'send_notification':
      return adapters.notifications.sendNotification(
        {
          channel: params.channel ? (String(params.channel) as 'slack') : 'slack',
          message: params.message ? String(params.message) : '',
          blocks: params.blocks ?? undefined,
          meta: (params.meta as Record<string, unknown>) ?? undefined,
        },
        ctx
      );

    case 'enrich_contact':
      return adapters.enrichment.enrichContact({
        email: params.email ? String(params.email) : '',
        name: params.name ? String(params.name) : undefined,
        title: params.title ? String(params.title) : undefined,
        company_name: params.company_name ? String(params.company_name) : undefined,
      });

    case 'enrich_company':
      return adapters.enrichment.enrichCompany({
        name: params.name ? String(params.name) : '',
        domain: params.domain ? String(params.domain) : undefined,
        website: params.website ? String(params.website) : undefined,
      });

    case 'invoke_skill': {
      // Skill composition: allows skills to invoke other skills
      const skillKey = params.skill_key ? String(params.skill_key) : '';
      if (!skillKey) {
        return { success: false, data: null, error: 'skill_key is required for invoke_skill' };
      }

      // Recursion protection
      const currentDepth = (params._invoke_depth as number) || 0;
      if (currentDepth >= MAX_INVOKE_DEPTH) {
        return {
          success: false,
          data: null,
          error: `Max skill nesting depth (${MAX_INVOKE_DEPTH}) exceeded. Skill chain: ${params._parent_skill || 'root'} → ${skillKey}`,
        };
      }

      // Circular dependency detection
      const parentSkill = params._parent_skill ? String(params._parent_skill) : null;
      if (parentSkill === skillKey) {
        return {
          success: false,
          data: null,
          error: `Circular skill invocation detected: ${skillKey} cannot invoke itself`,
        };
      }

      // Fetch the target skill from organization_skills or platform_skills
      const { data: skillData, error: skillError } = await client
        .from('organization_skills')
        .select(`
          skill_id,
          compiled_content,
          compiled_frontmatter,
          platform_skills:platform_skill_id(category, frontmatter, content_template, is_active)
        `)
        .eq('skill_id', skillKey)
        .eq('organization_id', orgId)
        .eq('is_enabled', true)
        .maybeSingle();

      if (skillError || !skillData) {
        return { success: false, data: null, error: `Skill not found: ${skillKey}` };
      }

      // Return skill data for the AI to process
      // The actual skill execution happens in the main copilot loop
      const mergedContext = params.merge_parent_context !== false
        ? { ...params._parent_context, ...params.context }
        : params.context || {};

      return {
        success: true,
        data: {
          skill_key: skillKey,
          skill_content: skillData.compiled_content || skillData.platform_skills?.content_template || '',
          skill_frontmatter: skillData.compiled_frontmatter || skillData.platform_skills?.frontmatter || {},
          context: mergedContext,
          invoke_metadata: {
            depth: currentDepth + 1,
            parent_skill: parentSkill,
            max_depth: MAX_INVOKE_DEPTH,
          },
        },
        source: 'invoke_skill',
      };
    }

    case 'get_booking_stats': {
      // Check if user is admin for org-wide queries
      let isAdmin = false;
      if (params.org_wide === true && orgId) {
        const { data: profile } = await client
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .maybeSingle();
        isAdmin = profile?.is_admin === true;
      }

      return adapters.meetings.getBookingStats({
        period: params.period ? String(params.period) : undefined,
        filter_by: params.filter_by ? String(params.filter_by) : undefined,
        source: params.source ? String(params.source) : undefined,
        org_wide: params.org_wide === true,
        isAdmin,
        orgId: orgId || undefined,
      });
    }

    case 'create_task': {
      // Create a task in the database
      const title = params.title ? String(params.title) : '';
      if (!title) {
        return { success: false, data: null, error: 'title is required for create_task' };
      }

      const taskData: Record<string, unknown> = {
        user_id: userId,
        org_id: orgId,
        title,
        description: params.description ? String(params.description) : null,
        status: 'pending',
        priority: params.priority || 'medium',
        created_at: new Date().toISOString(),
      };

      // Add optional relations
      if (params.due_date) {
        taskData.due_date = String(params.due_date);
      }
      if (params.contact_id) {
        taskData.contact_id = String(params.contact_id);
      }
      if (params.deal_id) {
        taskData.deal_id = String(params.deal_id);
      }
      if (params.assignee_id) {
        taskData.assignee_id = String(params.assignee_id);
      }

      const { data: newTask, error: taskError } = await client
        .from('tasks')
        .insert(taskData)
        .select('id, title, status, priority, due_date')
        .single();

      if (taskError) {
        return { success: false, data: null, error: `Failed to create task: ${taskError.message}` };
      }

      return {
        success: true,
        data: {
          task_id: newTask.id,
          title: newTask.title,
          status: newTask.status,
          priority: newTask.priority,
          due_date: newTask.due_date,
          message: `Task "${title}" created successfully`,
        },
        source: 'create_task',
      };
    }

    default:
      return { success: false, data: null, error: `Unknown action: ${String(action)}` };
  }
}

