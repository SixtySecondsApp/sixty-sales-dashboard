import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  ActionResult,
  AdapterContext,
  CRMAdapter,
  EmailAdapter,
  MeetingAdapter,
  NotificationAdapter,
} from './types.ts';

type SupabaseClient = ReturnType<typeof createClient>;

function ok(data: unknown, source: string): ActionResult {
  return { success: true, data, source };
}

function fail(error: string, source: string, extra?: Partial<ActionResult>): ActionResult {
  return { success: false, data: null, error, source, ...extra };
}

export function createDbMeetingAdapter(client: SupabaseClient, userId: string): MeetingAdapter {
  return {
    source: 'db_meetings',
    async listMeetings(params) {
      try {
        const limit = Math.min(Math.max(Number(params.limit ?? 5) || 5, 1), 20);

        let contactEmail: string | null = params.contactEmail ? String(params.contactEmail).trim() : null;
        const contactId: string | null = params.contactId ? String(params.contactId).trim() : null;

        if (!contactEmail && contactId) {
          const { data: contact, error } = await client
            .from('contacts')
            .select('email')
            .eq('id', contactId)
            .eq('owner_id', userId)
            .maybeSingle();
          if (error) throw error;
          contactEmail = contact?.email || null;
        }

        // We don't have a guaranteed contact-email → meeting link in schema; we use primary_contact_id
        let meetingsQuery = client
          .from('meetings')
          .select(
            'id,title,meeting_start,meeting_end,duration_minutes,summary,transcript_text,share_url,company_id,primary_contact_id'
          )
          .eq('owner_user_id', userId)
          .order('meeting_start', { ascending: false })
          .limit(limit);

        if (contactId) {
          meetingsQuery = meetingsQuery.eq('primary_contact_id', contactId);
        }

        const { data: meetings, error: meetingsError } = await meetingsQuery;
        if (meetingsError) throw meetingsError;

        return ok({ meetings: meetings || [], matchedOn: contactId ? 'primary_contact_id' : 'recent' }, this.source);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },
  };
}

export function createDbCrmAdapter(client: SupabaseClient, userId: string): CRMAdapter {
  return {
    source: 'db_crm',
    async getContact(params) {
      try {
        const id = params.id ? String(params.id).trim() : null;
        const email = params.email ? String(params.email).trim() : null;
        const name = params.name ? String(params.name).trim() : null;

        let q = client.from('contacts').select('*').eq('owner_id', userId);
        if (id) q = q.eq('id', id);
        if (email) q = q.eq('email', email);
        if (name && !id && !email) q = q.ilike('full_name', `%${name}%`);

        const { data, error } = await q.limit(10);
        if (error) throw error;

        return ok({ contacts: data || [] }, this.source);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },
    async getDeal(params) {
      try {
        const id = params.id ? String(params.id).trim() : null;
        const name = params.name ? String(params.name).trim() : null;

        let q = client
          .from('deals')
          .select('id,name,company,value,stage_id,status,expected_close_date,probability,created_at,updated_at')
          .eq('owner_id', userId);
        if (id) q = q.eq('id', id);
        if (name && !id) q = q.ilike('name', `%${name}%`);

        const { data, error } = await q.limit(10);
        if (error) throw error;

        return ok({ deals: data || [] }, this.source);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },
    async updateCRM(params, ctx) {
      const source = this.source;
      try {
        if (!ctx.confirm) {
          return fail('Confirmation required for write operations', source, {
            needs_confirmation: true,
            preview: { entity: params.entity, id: params.id, updates: params.updates },
          });
        }

        if (!params.id) {
          return fail('id is required', source);
        }

        const id = String(params.id);
        const updates = params.updates || {};

        switch (params.entity) {
          case 'deal': {
            const { data, error } = await client
              .from('deals')
              .update(updates)
              .eq('id', id)
              .eq('owner_id', userId)
              .select()
              .maybeSingle();
            if (error) throw error;
            return ok({ deal: data }, source);
          }
          case 'contact': {
            const { data, error } = await client
              .from('contacts')
              .update(updates)
              .eq('id', id)
              .eq('owner_id', userId)
              .select()
              .maybeSingle();
            if (error) throw error;
            return ok({ contact: data }, source);
          }
          case 'task': {
            const { data, error } = await client
              .from('tasks')
              .update(updates)
              .eq('id', id)
              .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
              .select()
              .maybeSingle();
            if (error) throw error;
            return ok({ task: data }, source);
          }
          case 'activity': {
            const { data, error } = await client
              .from('activities')
              .update(updates)
              .eq('id', id)
              .eq('owner_id', userId)
              .select()
              .maybeSingle();
            if (error) throw error;
            return ok({ activity: data }, source);
          }
          default:
            return fail(`Unsupported entity: ${String(params.entity)}`, source);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, source);
      }
    },
  };
}

export function createDbEmailAdapter(client: SupabaseClient, userId: string): EmailAdapter {
  return {
    source: 'db_email',
    async searchEmails(params) {
      try {
        const limit = Math.min(Math.max(Number(params.limit ?? 10) || 10, 1), 20);

        // Prefer existing emails table if present. Filter by user_id.
        // We do not assume a contact foreign key; prefer contact_email matching.
        const contactEmail = params.contact_email ? String(params.contact_email).trim() : null;
        const query = params.query ? String(params.query).trim() : null;

        let q = client
          .from('emails')
          .select('id,thread_id,subject,snippet,received_at,from,to,link')
          .eq('user_id', userId)
          .order('received_at', { ascending: false })
          .limit(limit);

        if (contactEmail) {
          // best-effort: match in from/to arrays stored as text/json
          q = q.or(`from.ilike.%${contactEmail}%,to.ilike.%${contactEmail}%`);
        }

        if (query) {
          q = q.or(`subject.ilike.%${query}%,snippet.ilike.%${query}%`);
        }

        const { data, error } = await q;
        if (error) throw error;

        return ok({ emails: data || [] }, this.source);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },
    async draftEmail(params) {
      // Drafting via model is handled by api-copilot itself; adapter returns a structured request.
      // This keeps execute_action stable even if implementation changes later.
      return ok(
        {
          draft: {
            to: params.to || null,
            subject: params.subject || null,
            body: null,
            context: params.context || null,
            tone: params.tone || null,
          },
          note: 'draft_email is not executed in db_email adapter; api-copilot should generate copy using the writing skill + context.',
        },
        this.source
      );
    },
  };
}

export function createDbNotificationAdapter(_client: SupabaseClient): NotificationAdapter {
  return {
    source: 'notifications',
    async sendNotification(params, ctx) {
      if (!ctx.confirm) {
        return fail('Confirmation required to send notifications', this.source, {
          needs_confirmation: true,
          preview: params,
        });
      }
      // Actual Slack sending is performed by api-copilot using existing slack edge functions.
      return ok(
        {
          queued: true,
          channel: params.channel || 'slack',
          message: params.message,
          blocks: params.blocks || null,
          meta: params.meta || null,
        },
        this.source
      );
    },
  };
}

