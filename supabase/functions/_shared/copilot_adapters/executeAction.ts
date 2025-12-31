import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AdapterRegistry } from './registry.ts';
import type { ActionResult, AdapterContext, ExecuteActionName } from './types.ts';

type SupabaseClient = ReturnType<typeof createClient>;

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

    default:
      return { success: false, data: null, error: `Unknown action: ${String(action)}` };
  }
}

