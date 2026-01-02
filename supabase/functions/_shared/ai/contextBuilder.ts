/**
 * AI Context Builder - Phase 6: Smart AI & Engagement
 *
 * Builds comprehensive context dossiers before AI generation.
 * Retrieval-first approach: gather all relevant data before generating content.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContextDossier,
  ContactContext,
  DealContext,
  MeetingContext,
  ActivityContext,
  MeetingSummary,
  EmailContext,
  UserAIPreferences,
} from './types.ts';

interface BuildContextOptions {
  contact_id?: string;
  deal_id?: string;
  meeting_id?: string;
  include_email_history?: boolean;
  max_activities?: number;
  max_previous_meetings?: number;
}

const DEFAULT_OPTIONS: Required<Omit<BuildContextOptions, 'contact_id' | 'deal_id' | 'meeting_id'>> = {
  include_email_history: true,
  max_activities: 10,
  max_previous_meetings: 5,
};

/**
 * Build a complete context dossier for AI generation
 */
export async function buildContextDossier(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  options: BuildContextOptions
): Promise<ContextDossier> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const contextSources: string[] = [];

  // Fetch user and org context first
  const [userContext, orgContext] = await Promise.all([
    getUserContext(supabase, userId, orgId),
    getOrgContext(supabase, orgId),
  ]);
  contextSources.push('user_profile', 'organization');

  // Fetch entity contexts in parallel
  const [contactContext, dealContext, meetingContext] = await Promise.all([
    opts.contact_id ? getContactContext(supabase, opts.contact_id, userId, opts) : null,
    opts.deal_id ? getDealContext(supabase, opts.deal_id, userId, opts) : null,
    opts.meeting_id ? getMeetingContext(supabase, opts.meeting_id, userId, opts) : null,
  ]);

  if (contactContext) contextSources.push('contact', 'contact_activities');
  if (dealContext) contextSources.push('deal', 'deal_stakeholders', 'deal_activities');
  if (meetingContext) contextSources.push('meeting', 'meeting_attendees', 'previous_meetings');

  // Get email context if requested and we have a contact
  let emailContext: EmailContext | null = null;
  if (opts.include_email_history && (contactContext || dealContext)) {
    emailContext = await getEmailContext(
      supabase,
      contactContext?.email || null,
      opts.deal_id || null
    );
    if (emailContext) contextSources.push('email_history');
  }

  // Calculate context quality score
  const contextQuality = calculateContextQuality({
    hasContact: !!contactContext,
    hasDeal: !!dealContext,
    hasMeeting: !!meetingContext,
    hasEmail: !!emailContext,
    contactComplete: contactContext ? isContactComplete(contactContext) : false,
    dealComplete: dealContext ? isDealComplete(dealContext) : false,
    hasActivities: (contactContext?.total_meetings || 0) > 0 || (dealContext?.recent_activities.length || 0) > 0,
  });

  // Determine timing context
  const now = new Date();
  const timingContext = {
    current_time: now.toISOString(),
    timezone: 'UTC', // TODO: Get from user preferences
    is_business_hours: isBusinessHours(now),
    urgency_level: determineUrgency(dealContext, meetingContext) as 'immediate' | 'today' | 'this_week' | 'flexible',
  };

  return {
    contact: contactContext,
    deal: dealContext,
    meeting: meetingContext,
    email_history: emailContext,
    user: userContext,
    org: orgContext,
    timing: timingContext,
    context_quality: contextQuality,
    context_sources: contextSources,
    generated_at: now.toISOString(),
  };
}

/**
 * Get user context including AI preferences
 */
async function getUserContext(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<ContextDossier['user']> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle();

  // Get user's AI preferences (or create defaults)
  const { data: prefs } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const preferences: UserAIPreferences = prefs || {
    preferred_tone: null,
    preferred_length: null,
    prefers_ctas: null,
    prefers_bullet_points: null,
    auto_approve_threshold: 90,
    always_hitl_actions: ['send_email', 'send_slack_message'],
    never_auto_send: false,
    notification_frequency: 'moderate',
    preferred_channels: ['slack_dm'],
    total_suggestions: 0,
    approval_rate: 0,
    edit_rate: 0,
    rejection_rate: 0,
    avg_time_to_decision_seconds: 0,
  };

  return {
    id: userId,
    name: profile?.full_name || 'User',
    role: profile?.role || null,
    org_id: orgId,
    preferences,
  };
}

/**
 * Get organization context
 */
async function getOrgContext(
  supabase: SupabaseClient,
  orgId: string
): Promise<ContextDossier['org']> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name, settings')
    .eq('id', orgId)
    .maybeSingle();

  const settings = (org?.settings || {}) as Record<string, unknown>;

  return {
    id: orgId,
    name: org?.name || 'Organization',
    industry: (settings.industry as string) || null,
    tone_guidelines: (settings.tone_guidelines as string) || null,
  };
}

/**
 * Get contact context with relationship history
 */
async function getContactContext(
  supabase: SupabaseClient,
  contactId: string,
  userId: string,
  opts: Required<Omit<BuildContextOptions, 'contact_id' | 'deal_id' | 'meeting_id'>>
): Promise<ContactContext | null> {
  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      id,
      name,
      email,
      company,
      title,
      last_contacted,
      relationship_health_score,
      notes
    `)
    .eq('id', contactId)
    .maybeSingle();

  if (!contact) return null;

  // Get meeting count
  const { count: meetingCount } = await supabase
    .from('meeting_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', contactId);

  // Extract objections and interests from notes/activities (simplified)
  const objections: string[] = [];
  const interests: string[] = [];

  // TODO: Could use AI to extract these from activities/notes
  // For now, return empty arrays

  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    company: contact.company,
    role: contact.title,
    last_contacted: contact.last_contacted,
    total_meetings: meetingCount || 0,
    relationship_score: contact.relationship_health_score,
    objections,
    interests,
    communication_style: null, // TODO: Learn from email analysis
  };
}

/**
 * Get deal context with stakeholders and activities
 */
async function getDealContext(
  supabase: SupabaseClient,
  dealId: string,
  userId: string,
  opts: Required<Omit<BuildContextOptions, 'contact_id' | 'deal_id' | 'meeting_id'>>
): Promise<DealContext | null> {
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      company,
      value,
      probability,
      expected_close_date,
      stage_entered_at,
      deal_stages ( name )
    `)
    .eq('id', dealId)
    .maybeSingle();

  if (!deal) return null;

  // Calculate days in stage
  const daysInStage = deal.stage_entered_at
    ? Math.floor((Date.now() - new Date(deal.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Determine if at risk
  const isAtRisk = daysInStage > 14 || (deal.probability !== null && deal.probability < 30);

  // Get stakeholders (contacts linked to deal)
  const { data: dealContacts } = await supabase
    .from('deal_contacts')
    .select(`
      contacts (
        id,
        name,
        email,
        company,
        title,
        relationship_health_score
      )
    `)
    .eq('deal_id', dealId)
    .limit(10);

  const stakeholders: ContactContext[] = (dealContacts || [])
    .filter((dc: any) => dc.contacts)
    .map((dc: any) => ({
      id: dc.contacts.id,
      name: dc.contacts.name,
      email: dc.contacts.email,
      company: dc.contacts.company,
      role: dc.contacts.title,
      last_contacted: null,
      total_meetings: 0,
      relationship_score: dc.contacts.relationship_health_score,
      objections: [],
      interests: [],
      communication_style: null,
    }));

  // Get recent activities
  const { data: activities } = await supabase
    .from('activities')
    .select('id, activity_type, description, created_at, outcome')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(opts.max_activities);

  const recentActivities: ActivityContext[] = (activities || []).map((a: any) => ({
    id: a.id,
    type: a.activity_type,
    description: a.description || '',
    created_at: a.created_at,
    outcome: a.outcome,
  }));

  return {
    id: deal.id,
    name: deal.name,
    company: deal.company,
    value: deal.value || 0,
    stage: (deal.deal_stages as any)?.name || 'Unknown',
    probability: deal.probability,
    expected_close: deal.expected_close_date,
    days_in_stage: daysInStage,
    is_at_risk: isAtRisk,
    stakeholders,
    recent_activities: recentActivities,
    objections_raised: [], // TODO: Extract from activities
    next_steps: [], // TODO: Extract from activities/tasks
  };
}

/**
 * Get meeting context with attendees and previous meetings
 */
async function getMeetingContext(
  supabase: SupabaseClient,
  meetingId: string,
  userId: string,
  opts: Required<Omit<BuildContextOptions, 'contact_id' | 'deal_id' | 'meeting_id'>>
): Promise<MeetingContext | null> {
  const { data: meeting } = await supabase
    .from('meetings')
    .select(`
      id,
      title,
      scheduled_at,
      duration_minutes,
      agenda,
      prep_notes,
      deal_id,
      deals ( id, name, company, value, deal_stages ( name ) )
    `)
    .eq('id', meetingId)
    .maybeSingle();

  if (!meeting) return null;

  // Get attendees
  const { data: attendeeData } = await supabase
    .from('meeting_attendees')
    .select(`
      contacts (
        id,
        name,
        email,
        company,
        title,
        relationship_health_score
      )
    `)
    .eq('meeting_id', meetingId)
    .limit(20);

  const attendees: ContactContext[] = (attendeeData || [])
    .filter((a: any) => a.contacts)
    .map((a: any) => ({
      id: a.contacts.id,
      name: a.contacts.name,
      email: a.contacts.email,
      company: a.contacts.company,
      role: a.contacts.title,
      last_contacted: null,
      total_meetings: 0,
      relationship_score: a.contacts.relationship_health_score,
      objections: [],
      interests: [],
      communication_style: null,
    }));

  // Get previous meetings with same attendees
  const attendeeIds = attendees.map(a => a.id);
  let previousMeetings: MeetingSummary[] = [];

  if (attendeeIds.length > 0) {
    const { data: prevMeetings } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        scheduled_at,
        summary,
        action_items,
        sentiment
      `)
      .neq('id', meetingId)
      .lt('scheduled_at', meeting.scheduled_at)
      .order('scheduled_at', { ascending: false })
      .limit(opts.max_previous_meetings);

    previousMeetings = (prevMeetings || []).map((m: any) => ({
      id: m.id,
      date: m.scheduled_at,
      title: m.title,
      key_points: m.summary ? [m.summary] : [],
      action_items: m.action_items || [],
      sentiment: m.sentiment,
    }));
  }

  // Build related deal context (simplified)
  let relatedDeal: DealContext | null = null;
  if (meeting.deals) {
    const d = meeting.deals as any;
    relatedDeal = {
      id: d.id,
      name: d.name,
      company: d.company,
      value: d.value || 0,
      stage: d.deal_stages?.name || 'Unknown',
      probability: null,
      expected_close: null,
      days_in_stage: 0,
      is_at_risk: false,
      stakeholders: [],
      recent_activities: [],
      objections_raised: [],
      next_steps: [],
    };
  }

  return {
    id: meeting.id,
    title: meeting.title,
    scheduled_at: meeting.scheduled_at,
    duration_minutes: meeting.duration_minutes || 30,
    attendees,
    related_deal: relatedDeal,
    previous_meetings: previousMeetings,
    agenda_items: meeting.agenda || [],
    prep_notes: meeting.prep_notes,
  };
}

/**
 * Get email context (placeholder - would integrate with email provider)
 */
async function getEmailContext(
  supabase: SupabaseClient,
  contactEmail: string | null,
  dealId: string | null
): Promise<EmailContext | null> {
  // TODO: Integrate with email provider (Gmail, Outlook)
  // For now, return null to indicate no email history available
  return null;
}

/**
 * Calculate overall context quality score
 */
function calculateContextQuality(factors: {
  hasContact: boolean;
  hasDeal: boolean;
  hasMeeting: boolean;
  hasEmail: boolean;
  contactComplete: boolean;
  dealComplete: boolean;
  hasActivities: boolean;
}): number {
  let score = 20; // Base score

  if (factors.hasContact) score += 15;
  if (factors.hasDeal) score += 15;
  if (factors.hasMeeting) score += 10;
  if (factors.hasEmail) score += 10;
  if (factors.contactComplete) score += 10;
  if (factors.dealComplete) score += 10;
  if (factors.hasActivities) score += 10;

  return Math.min(100, score);
}

/**
 * Check if contact has complete information
 */
function isContactComplete(contact: ContactContext): boolean {
  return !!(
    contact.name &&
    contact.email &&
    contact.company &&
    contact.role
  );
}

/**
 * Check if deal has complete information
 */
function isDealComplete(deal: DealContext): boolean {
  return !!(
    deal.name &&
    deal.value > 0 &&
    deal.stage &&
    deal.expected_close
  );
}

/**
 * Check if current time is within business hours
 */
function isBusinessHours(now: Date): boolean {
  const hour = now.getHours();
  const day = now.getDay();
  return day >= 1 && day <= 5 && hour >= 9 && hour <= 18;
}

/**
 * Determine urgency based on deal/meeting context
 */
function determineUrgency(
  deal: DealContext | null,
  meeting: MeetingContext | null
): string {
  const now = Date.now();

  // Meeting within 24 hours = immediate
  if (meeting) {
    const meetingTime = new Date(meeting.scheduled_at).getTime();
    const hoursUntil = (meetingTime - now) / (1000 * 60 * 60);
    if (hoursUntil <= 24) return 'immediate';
    if (hoursUntil <= 72) return 'today';
  }

  // Deal closing this week = today
  if (deal?.expected_close) {
    const closeDate = new Date(deal.expected_close).getTime();
    const daysUntil = (closeDate - now) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 7) return 'today';
    if (daysUntil <= 14) return 'this_week';
  }

  // At-risk deal = today
  if (deal?.is_at_risk) return 'today';

  return 'flexible';
}
