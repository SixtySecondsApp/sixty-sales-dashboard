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

    case 'get_lead': {
      // Get lead with enrichment data from leads table (SavvyCal bookings, prep data, etc.)
      const email = params.email ? String(params.email) : undefined;
      const name = params.name ? String(params.name) : undefined;
      const contactId = params.contact_id ? String(params.contact_id) : undefined;

      if (!email && !name && !contactId) {
        return { success: false, data: null, error: 'get_lead requires email, name, or contact_id' };
      }

      let query = client
        .from('leads')
        .select(`
          id,
          external_source,
          status,
          priority,
          enrichment_status,
          enrichment_provider,
          prep_status,
          prep_summary,
          contact_id,
          contact_name,
          contact_first_name,
          contact_last_name,
          contact_email,
          contact_phone,
          contact_timezone,
          domain,
          meeting_title,
          meeting_description,
          meeting_start,
          meeting_end,
          meeting_duration_minutes,
          meeting_timezone,
          meeting_url,
          conferencing_type,
          conferencing_url,
          metadata,
          created_at,
          updated_at
        `)
        .is('deleted_at', null)
        .order('meeting_start', { ascending: false, nullsFirst: false });

      // Apply filters
      if (contactId) {
        query = query.eq('contact_id', contactId);
      } else if (email) {
        query = query.ilike('contact_email', `%${email}%`);
      } else if (name) {
        query = query.ilike('contact_name', `%${name}%`);
      }

      const { data: leads, error: leadsError } = await query.limit(5);

      if (leadsError) {
        return { success: false, data: null, error: `Failed to fetch leads: ${leadsError.message}` };
      }

      if (!leads || leads.length === 0) {
        return {
          success: true,
          data: {
            found: false,
            message: `No leads found for ${email || name || contactId}`
          },
          source: 'leads'
        };
      }

      // Fetch prep notes/insights for all found leads
      const leadIds = leads.map((l: any) => l.id);
      const { data: prepNotes } = await client
        .from('lead_prep_notes')
        .select('lead_id, note_type, title, body, is_auto_generated, sort_order')
        .in('lead_id', leadIds)
        .order('sort_order', { ascending: true });

      // Group prep notes by lead_id
      const notesByLeadId: Record<string, any[]> = {};
      if (prepNotes) {
        prepNotes.forEach((note: any) => {
          if (!notesByLeadId[note.lead_id]) {
            notesByLeadId[note.lead_id] = [];
          }
          notesByLeadId[note.lead_id].push(note);
        });
      }

      // Extract useful enrichment data from metadata
      const enrichedLeads = leads.map((lead: any) => {
        const metadata = lead.metadata || {};

        // Extract custom fields from SavvyCal
        const customFields: Record<string, string> = {};
        if (metadata.savvycal?.fields?.attendee) {
          metadata.savvycal.fields.attendee.forEach((field: any) => {
            if (field.label && field.value) {
              customFields[field.label] = field.value;
            }
          });
        }
        // Also check top-level question fields
        if (metadata.question_1?.question && metadata.question_1?.answer) {
          customFields[metadata.question_1.question] = metadata.question_1.answer;
        }
        if (metadata.question_2?.question && metadata.question_2?.answer) {
          customFields[metadata.question_2.question] = metadata.question_2.answer;
        }

        return {
          id: lead.id,
          source: lead.external_source,
          status: lead.status,
          priority: lead.priority,

          // Contact info
          contact: {
            id: lead.contact_id,
            name: lead.contact_name,
            first_name: lead.contact_first_name,
            last_name: lead.contact_last_name,
            email: lead.contact_email,
            phone: lead.contact_phone || customFields['Phone'] || null,
            timezone: lead.contact_timezone,
          },

          // Company/domain
          domain: lead.domain,

          // Meeting info
          meeting: lead.meeting_start ? {
            title: lead.meeting_title,
            description: lead.meeting_description,
            start: lead.meeting_start,
            end: lead.meeting_end,
            duration_minutes: lead.meeting_duration_minutes,
            timezone: lead.meeting_timezone,
            url: lead.meeting_url,
            conferencing_type: lead.conferencing_type,
            conferencing_url: lead.conferencing_url || metadata.conferencing?.join_url,
          } : null,

          // Enrichment data
          enrichment: {
            status: lead.enrichment_status,
            provider: lead.enrichment_provider,
            prep_status: lead.prep_status,
            prep_summary: lead.prep_summary,
            research_summary: metadata.prep_ai?.research_summary || null,
          },

          // Custom fields from booking form
          custom_fields: Object.keys(customFields).length > 0 ? customFields : null,

          // Raw metadata for additional context
          booking_source: metadata.savvycal ? 'savvycal' : metadata.import_source || null,

          // Prep notes and insights (from lead_prep_notes table)
          prep_notes: notesByLeadId[lead.id]?.filter((n: any) => n.note_type !== 'insight') || [],
          insights: notesByLeadId[lead.id]?.filter((n: any) => n.note_type === 'insight').map((n: any) => ({
            title: n.title,
            body: n.body,
            is_auto_generated: n.is_auto_generated,
          })) || [],

          created_at: lead.created_at,
          updated_at: lead.updated_at,
        };
      });

      return {
        success: true,
        data: {
          found: true,
          count: enrichedLeads.length,
          leads: enrichedLeads,
        },
        source: 'leads',
      };
    }

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

