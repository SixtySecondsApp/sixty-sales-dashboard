/**
 * Copilot Adapters - shared types (Deno)
 *
 * These adapters are used by api-copilot's execute_action tool to provide a
 * stable execution layer across CRM/meetings/email/notifications.
 */

export type SkillCategory =
  | 'sales-ai'
  | 'writing'
  | 'enrichment'
  | 'workflows'
  | 'data-access'
  | 'output-format';

export interface SkillDoc {
  skill_key: string;
  category: SkillCategory | string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export type ExecuteActionName =
  | 'get_contact'
  | 'get_deal'
  | 'get_meetings'
  | 'search_emails'
  | 'draft_email'
  | 'update_crm'
  | 'send_notification'
  | 'enrich_contact'
  | 'enrich_company';

export interface ExecuteActionRequest {
  action: ExecuteActionName;
  params: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  data: unknown;
  error?: string;
  needs_confirmation?: boolean;
  preview?: unknown;
  source?: string;
}

export interface AdapterContext {
  userId: string;
  orgId: string | null;
  confirm: boolean;
}

export interface MeetingAdapter {
  source: string;
  listMeetings(params: {
    contactEmail?: string;
    contactId?: string;
    limit?: number;
  }): Promise<ActionResult>;
}

export interface CRMAdapter {
  source: string;
  getContact(params: { id?: string; email?: string; name?: string }): Promise<ActionResult>;
  getDeal(params: { id?: string; name?: string }): Promise<ActionResult>;
  updateCRM(params: { entity: 'deal' | 'contact' | 'task' | 'activity'; id: string; updates: Record<string, unknown> }, ctx: AdapterContext): Promise<ActionResult>;
}

export interface EmailAdapter {
  source: string;
  searchEmails(params: { contact_email?: string; contact_id?: string; contact_name?: string; query?: string; limit?: number }): Promise<ActionResult>;
  draftEmail(params: { to?: string; subject?: string; context?: string; tone?: string }): Promise<ActionResult>;
}

export interface NotificationAdapter {
  source: string;
  sendNotification(params: { channel?: 'slack'; message: string; blocks?: unknown; meta?: Record<string, unknown> }, ctx: AdapterContext): Promise<ActionResult>;
}

export interface EnrichmentAdapter {
  source: string;
  enrichContact(params: { email: string; name?: string; title?: string; company_name?: string }): Promise<ActionResult>;
  enrichCompany(params: { name: string; domain?: string; website?: string }): Promise<ActionResult>;
}

