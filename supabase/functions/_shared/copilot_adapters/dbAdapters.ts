import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  ActionResult,
  AdapterContext,
  CRMAdapter,
  EmailAdapter,
  EnrichmentAdapter,
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

        let contactEmail: string | null = params.contactEmail ? String(params.contactEmail).trim().toLowerCase() : null;
        let contactId: string | null = params.contactId ? String(params.contactId).trim() : null;

        // If we have contactId but no email, look up the email
        if (!contactEmail && contactId) {
          const { data: contact, error } = await client
            .from('contacts')
            .select('email')
            .eq('id', contactId)
            .eq('owner_id', userId)
            .maybeSingle();
          if (error) throw error;
          contactEmail = contact?.email?.toLowerCase() || null;
        }

        // If we have contactEmail but no contactId, try to find the contact
        if (contactEmail && !contactId) {
          const { data: contact, error } = await client
            .from('contacts')
            .select('id')
            .eq('owner_id', userId)
            .ilike('email', contactEmail)
            .maybeSingle();
          if (!error && contact) {
            contactId = contact.id;
          }
        }

        // Strategy 1: If we have a contactId, filter by primary_contact_id
        if (contactId) {
          const { data: meetings, error: meetingsError } = await client
            .from('meetings')
            .select(
              'id,title,meeting_start,meeting_end,duration_minutes,summary,transcript_text,share_url,company_id,primary_contact_id'
            )
            .eq('owner_user_id', userId)
            .eq('primary_contact_id', contactId)
            .order('meeting_start', { ascending: false })
            .limit(limit);

          if (meetingsError) throw meetingsError;
          return ok({ meetings: meetings || [], matchedOn: 'primary_contact_id' }, this.source);
        }

        // Strategy 2: If we have a contactEmail but no contactId (not in CRM), search meeting_attendees
        if (contactEmail) {
          // Find meeting IDs where this email is an attendee
          const { data: attendeeRecords, error: attendeeError } = await client
            .from('meeting_attendees')
            .select('meeting_id')
            .ilike('email', contactEmail)
            .limit(limit);

          if (attendeeError) throw attendeeError;

          if (attendeeRecords && attendeeRecords.length > 0) {
            const meetingIds = attendeeRecords.map((a) => a.meeting_id);

            const { data: meetings, error: meetingsError } = await client
              .from('meetings')
              .select(
                'id,title,meeting_start,meeting_end,duration_minutes,summary,transcript_text,share_url,company_id,primary_contact_id'
              )
              .eq('owner_user_id', userId)
              .in('id', meetingIds)
              .order('meeting_start', { ascending: false })
              .limit(limit);

            if (meetingsError) throw meetingsError;
            return ok({ meetings: meetings || [], matchedOn: 'attendee_email' }, this.source);
          }

          // No meetings found with this attendee email
          return ok(
            {
              meetings: [],
              matchedOn: 'attendee_email',
              note: `No meetings found with attendee email: ${contactEmail}`,
            },
            this.source
          );
        }

        // Fallback: No contact identifier provided - return recent meetings
        const { data: meetings, error: meetingsError } = await client
          .from('meetings')
          .select(
            'id,title,meeting_start,meeting_end,duration_minutes,summary,transcript_text,share_url,company_id,primary_contact_id'
          )
          .eq('owner_user_id', userId)
          .order('meeting_start', { ascending: false })
          .limit(limit);

        if (meetingsError) throw meetingsError;
        return ok({ meetings: meetings || [], matchedOn: 'recent' }, this.source);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },

    async getBookingStats(params) {
      try {
        const period = params.period || 'this_week';
        const filterBy = params.filter_by || 'meeting_date';
        const source = params.source || 'all';
        const orgWide = params.org_wide === true && params.isAdmin === true;

        // Calculate date range based on period
        const { startDate, endDate } = calculateDateRange(period);

        // Determine which date column to filter on
        const dateColumn = filterBy === 'booking_date' ? 'created_at' : 'meeting_start';
        const calendarDateColumn = filterBy === 'booking_date' ? 'created_at' : 'start_time';

        const stats: {
          period: string;
          filter_by: string;
          startDate: string;
          endDate: string;
          scope: string;
          sources: Record<string, { count: number; items: unknown[] }>;
        } = {
          period,
          filter_by: filterBy,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          scope: orgWide ? 'organization' : 'user',
          sources: {},
        };

        // Query SavvyCal bookings from leads table
        if (source === 'all' || source === 'savvycal') {
          let memberIds: string[] = [];

          // For org-wide, get all org members first
          if (orgWide && params.orgId) {
            const { data: orgMembers } = await client
              .from('organization_memberships')
              .select('user_id')
              .eq('org_id', params.orgId);
            memberIds = (orgMembers || []).map((m) => m.user_id);
          }

          let q = client
            .from('leads')
            .select('id, meeting_title, meeting_start, contact_name, contact_email, created_at, owner_id')
            .eq('external_source', 'savvycal')
            .is('deleted_at', null)
            .gte(dateColumn, startDate.toISOString())
            .lte(dateColumn, endDate.toISOString())
            .order(dateColumn, { ascending: true });

          // Scope filtering
          if (orgWide && memberIds.length > 0) {
            q = q.in('owner_id', memberIds);
          } else {
            q = q.eq('owner_id', userId);
          }

          const { data: leads } = await q;
          stats.sources.savvycal = { count: leads?.length || 0, items: leads || [] };
        }

        // Query calendar events
        if (source === 'all' || source === 'calendar') {
          let q = client
            .from('calendar_events')
            .select('id, title, start_time, end_time, attendees_count, user_id')
            .neq('status', 'cancelled')
            .gte(calendarDateColumn, startDate.toISOString())
            .lte(calendarDateColumn, endDate.toISOString())
            .order(calendarDateColumn, { ascending: true });

          if (orgWide && params.orgId) {
            q = q.eq('org_id', params.orgId);
          } else {
            q = q.eq('user_id', userId);
          }

          const { data: events } = await q;
          stats.sources.calendar = { count: events?.length || 0, items: events || [] };
        }

        // Query completed meetings (Fathom)
        if (source === 'all' || source === 'meetings') {
          let q = client
            .from('meetings')
            .select('id, title, meeting_start, duration_minutes, owner_user_id')
            .gte('meeting_start', startDate.toISOString())
            .lte('meeting_start', endDate.toISOString())
            .order('meeting_start', { ascending: true });

          if (orgWide && params.orgId) {
            q = q.eq('org_id', params.orgId);
          } else {
            q = q.eq('owner_user_id', userId);
          }

          const { data: meetings } = await q;
          stats.sources.meetings = { count: meetings?.length || 0, items: meetings || [] };
        }

        // Calculate totals
        const totalCount = Object.values(stats.sources).reduce((sum, s) => sum + s.count, 0);

        return ok(
          {
            total_bookings: totalCount,
            ...stats,
          },
          this.source
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },
  };
}

/**
 * Helper function to calculate date range based on period string
 */
function calculateDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { startDate: startOfDay(startOfWeek), endDate: endOfDay(endOfWeek) };
    }
    case 'last_week': {
      const dayOfWeek = now.getDay();
      const startOfLastWeek = new Date(now);
      startOfLastWeek.setDate(now.getDate() - dayOfWeek - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
      return { startDate: startOfDay(startOfLastWeek), endDate: endOfDay(endOfLastWeek) };
    }
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: startOfDay(startOfMonth), endDate: endOfDay(endOfMonth) };
    }
    case 'last_month': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: startOfDay(startOfLastMonth), endDate: endOfDay(endOfLastMonth) };
    }
    case 'last_7_days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { startDate: startOfDay(start), endDate: endOfDay(now) };
    }
    case 'last_30_days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      return { startDate: startOfDay(start), endDate: endOfDay(now) };
    }
    default:
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
  }
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

const GEMINI_MODEL = Deno.env.get('GEMINI_FLASH_MODEL') ?? Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_GEMINI_API_KEY') ?? '';

/**
 * Parse Gemini JSON response with robust error handling
 */
function parseGeminiResponse(text: string): Record<string, unknown> {
  // Remove markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  let jsonString = jsonMatch ? jsonMatch[1] : text;

  // Extract JSON object
  if (!jsonString.trim().startsWith('{')) {
    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonString = objectMatch[0];
  }

  // Clean up - find first/last braces
  jsonString = jsonString.trim();
  const firstBrace = jsonString.indexOf('{');
  const lastBrace = jsonString.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas
  jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(jsonString);
}

export function createEnrichmentAdapter(): EnrichmentAdapter {
  return {
    source: 'gemini_enrichment',
    async enrichContact(params) {
      if (!GEMINI_API_KEY) {
        return fail('GEMINI_API_KEY not configured', this.source);
      }

      try {
        const name = params.name || params.email.split('@')[0];
        const prompt = `You are a B2B sales intelligence enrichment assistant. Given the following contact information, research and enrich it with comprehensive data for sales qualification and ICP matching.

Contact Information:
- Name: ${name}
- Email: ${params.email}
- Current Title: ${params.title || 'Not provided'}
- Company: ${params.company_name || 'Not provided'}

Return ONLY valid JSON with these fields (use null for unknown, never omit required fields):
{
  "title": "Accurate job title",
  "seniority_level": "One of: C-Suite, VP, Director, Manager, Senior IC, IC, Unknown",
  "department": "One of: Executive, Sales, Marketing, Engineering, Product, Operations, Finance, HR, Legal, IT, Customer Success, Unknown",
  "linkedin_url": "LinkedIn profile URL (format: https://linkedin.com/in/username)",
  "industry": "Industry classification",
  "years_in_role": "Estimated years in current role (number or null)",
  "decision_maker_signals": {
    "has_budget_authority": true/false,
    "is_final_decision_maker": true/false,
    "influences_purchases": true/false,
    "reports_to": "Title of their likely manager"
  },
  "professional_background": {
    "education": "Highest degree and institution if known",
    "previous_companies": ["List of notable previous employers"],
    "expertise_areas": ["Key skills and expertise areas"],
    "certifications": ["Relevant certifications"]
  },
  "social_presence": {
    "twitter_url": "Twitter/X profile URL if known",
    "personal_website": "Personal website or blog if known"
  },
  "engagement_insights": {
    "likely_pain_points": ["Common challenges for this role"],
    "conversation_starters": ["Topics they likely care about"],
    "best_contact_method": "One of: email, linkedin, phone, twitter"
  },
  "summary": "Brief professional summary (2-3 sentences including notable achievements)",
  "confidence": 0.5,
  "data_freshness": "estimated date of information accuracy (YYYY-MM or 'current')"
}`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topP: 0.8,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Gemini API error:', errorText);
          return fail(`Gemini API error: ${response.status}`, this.source);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();

        if (!text) {
          return fail('Empty response from Gemini', this.source);
        }

        const enriched = parseGeminiResponse(text);
        return ok(
          {
            enriched_contact: {
              // Core fields
              title: enriched.title,
              seniority_level: enriched.seniority_level,
              department: enriched.department,
              linkedin_url: enriched.linkedin_url,
              industry: enriched.industry,
              years_in_role: enriched.years_in_role,
              // Decision maker signals for ICP matching
              decision_maker_signals: enriched.decision_maker_signals || {
                has_budget_authority: null,
                is_final_decision_maker: null,
                influences_purchases: null,
                reports_to: null,
              },
              // Professional background
              professional_background: enriched.professional_background || {
                education: null,
                previous_companies: [],
                expertise_areas: [],
                certifications: [],
              },
              // Social presence
              social_presence: enriched.social_presence || {
                twitter_url: null,
                personal_website: null,
              },
              // Engagement insights for sales
              engagement_insights: enriched.engagement_insights || {
                likely_pain_points: [],
                conversation_starters: [],
                best_contact_method: 'email',
              },
              summary: enriched.summary,
              confidence: enriched.confidence || 0.5,
              data_freshness: enriched.data_freshness || 'current',
            },
            original: { email: params.email, name, title: params.title, company_name: params.company_name },
          },
          this.source
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },

    async enrichCompany(params) {
      if (!GEMINI_API_KEY) {
        return fail('GEMINI_API_KEY not configured', this.source);
      }

      try {
        const prompt = `You are a B2B sales intelligence enrichment assistant. Given the following company information, research and enrich it with comprehensive data for sales qualification and ICP matching.

Company Information:
- Name: ${params.name}
- Domain: ${params.domain || 'Not provided'}
- Website: ${params.website || 'Not provided'}

Return ONLY valid JSON with these fields (use null for unknown, never omit required fields):
{
  "industry": "Standardized industry classification (e.g., SaaS, Healthcare, FinTech, E-commerce)",
  "sub_industry": "More specific industry vertical",
  "size_category": "One of: Startup (1-10), Small (11-50), Medium (51-200), Large (201-1000), Enterprise (1000+)",
  "employee_count": {
    "estimate": "Number or range like 50-100",
    "source": "LinkedIn, Crunchbase, Website, or estimated"
  },
  "revenue": {
    "range": "One of: Pre-revenue, <$1M, $1-10M, $10-50M, $50-100M, $100M-500M, $500M+, Unknown",
    "currency": "USD",
    "source": "Crunchbase, estimate, or unknown"
  },
  "funding": {
    "stage": "One of: Bootstrapped, Pre-seed, Seed, Series A, Series B, Series C+, Public, Private Equity, Unknown",
    "total_raised": "Amount if known",
    "last_round_date": "YYYY-MM if known",
    "key_investors": ["Notable investors"]
  },
  "technology_stack": {
    "categories": ["e.g., Cloud, CRM, Marketing Automation, Analytics"],
    "known_tools": ["Specific tools like Salesforce, HubSpot, AWS"],
    "tech_sophistication": "One of: Low, Medium, High, Enterprise"
  },
  "company_signals": {
    "growth_indicators": ["Recent hires, expansion, new products"],
    "challenges": ["Common pain points for this type of company"],
    "buying_triggers": ["Events that might trigger purchases"],
    "budget_cycle": "Fiscal year end if known (e.g., December, Q4)"
  },
  "market_position": {
    "competitors": ["Key competitors"],
    "differentiators": ["What makes them unique"],
    "target_market": "Their target customer profile"
  },
  "description": "Professional company description (2-3 sentences)",
  "linkedin_url": "LinkedIn company page URL",
  "website": "Official website URL",
  "address": {
    "headquarters": "HQ address",
    "other_locations": ["Other office locations"]
  },
  "phone": "Company phone number",
  "founded_year": "Year founded",
  "social_presence": {
    "twitter_url": "Twitter/X company page",
    "blog_url": "Company blog if exists"
  },
  "confidence": 0.5,
  "data_freshness": "estimated date of information accuracy (YYYY-MM or 'current')"
}`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topP: 0.8,
              maxOutputTokens: 2500,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Gemini API error:', errorText);
          return fail(`Gemini API error: ${response.status}`, this.source);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();

        if (!text) {
          return fail('Empty response from Gemini', this.source);
        }

        const enriched = parseGeminiResponse(text);
        return ok(
          {
            enriched_company: {
              // Core fields
              industry: enriched.industry,
              sub_industry: enriched.sub_industry,
              size_category: enriched.size_category || enriched.size,
              description: enriched.description,
              linkedin_url: enriched.linkedin_url,
              website: enriched.website,
              phone: enriched.phone,
              founded_year: enriched.founded_year,
              // Employee count for ICP matching
              employee_count: enriched.employee_count || {
                estimate: null,
                source: 'unknown',
              },
              // Revenue data for qualification
              revenue: enriched.revenue || {
                range: 'Unknown',
                currency: 'USD',
                source: 'unknown',
              },
              // Funding information
              funding: enriched.funding || {
                stage: 'Unknown',
                total_raised: null,
                last_round_date: null,
                key_investors: [],
              },
              // Technology stack for targeting
              technology_stack: enriched.technology_stack || {
                categories: [],
                known_tools: [],
                tech_sophistication: 'Unknown',
              },
              // Buying signals and pain points
              company_signals: enriched.company_signals || {
                growth_indicators: [],
                challenges: [],
                buying_triggers: [],
                budget_cycle: null,
              },
              // Competitive landscape
              market_position: enriched.market_position || {
                competitors: [],
                differentiators: [],
                target_market: null,
              },
              // Address information
              address: typeof enriched.address === 'string'
                ? { headquarters: enriched.address, other_locations: [] }
                : enriched.address || { headquarters: null, other_locations: [] },
              // Social presence
              social_presence: enriched.social_presence || {
                twitter_url: null,
                blog_url: null,
              },
              confidence: enriched.confidence || 0.5,
              data_freshness: enriched.data_freshness || 'current',
            },
            original: { name: params.name, domain: params.domain, website: params.website },
          },
          this.source
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(msg, this.source);
      }
    },
  };
}

