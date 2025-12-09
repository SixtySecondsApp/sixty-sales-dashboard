// supabase/functions/slack-meeting-prep/index.ts
// Posts Pre-Meeting Prep Cards to Slack 30 mins before meetings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { buildMeetingPrepMessage, type MeetingPrepData } from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://use60.com';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  user_id: string;
  attendee_emails?: string[];
  meeting_url?: string;
  org_id: string;
}

interface Contact {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  is_decision_maker?: boolean;
}

interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  stage?: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  win_probability?: number;
  created_at: string;
}

/**
 * Get upcoming meetings (25-35 mins from now)
 */
async function getUpcomingMeetings(
  supabase: ReturnType<typeof createClient>,
  orgId?: string
): Promise<CalendarEvent[]> {
  const now = new Date();
  const in25Mins = new Date(now.getTime() + 25 * 60 * 1000);
  const in35Mins = new Date(now.getTime() + 35 * 60 * 1000);

  let query = supabase
    .from('calendar_events')
    .select('id, title, start_time, user_id, attendee_emails, meeting_url, org_id')
    .gte('start_time', in25Mins.toISOString())
    .lte('start_time', in35Mins.toISOString());

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching upcoming meetings:', error);
    return [];
  }

  return data || [];
}

/**
 * Get contacts by email
 */
async function getContactsByEmail(
  supabase: ReturnType<typeof createClient>,
  emails: string[]
): Promise<Contact[]> {
  if (!emails || emails.length === 0) return [];

  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, first_name, last_name, title, email, is_decision_maker')
    .in('email', emails.map(e => e.toLowerCase()));

  return data || [];
}

/**
 * Get company for contacts
 */
async function getCompanyForContact(
  supabase: ReturnType<typeof createClient>,
  contactId: string
): Promise<Company | null> {
  const { data } = await supabase
    .from('contacts')
    .select(`
      companies:company_id (
        id,
        name,
        industry,
        size,
        stage
      )
    `)
    .eq('id', contactId)
    .single();

  return (data?.companies as Company) || null;
}

/**
 * Get deal for company
 */
async function getDealForCompany(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
  userId: string
): Promise<Deal | null> {
  const { data } = await supabase
    .from('deals')
    .select('id, title, value, stage, win_probability, created_at')
    .ilike('title', `%${companyName}%`)
    .eq('user_id', userId)
    .in('stage', ['sql', 'opportunity', 'verbal'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

/**
 * Get last meeting notes
 */
async function getLastMeetingNotes(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
  userId: string
): Promise<{ notes: string; date: string } | null> {
  const { data } = await supabase
    .from('meetings')
    .select('summary, created_at')
    .ilike('title', `%${companyName}%`)
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data?.summary) return null;

  return {
    notes: data.summary.substring(0, 500),
    date: new Date(data.created_at).toLocaleDateString(),
  };
}

/**
 * Get recent activities
 */
async function getRecentActivities(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('activities')
    .select('type, notes, created_at')
    .ilike('company_name', `%${companyName}%`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return '';

  return data.map((a) => {
    const date = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const notes = a.notes ? `: ${a.notes.substring(0, 50)}` : '';
    return `- ${date}: ${a.type}${notes}`;
  }).join('\n');
}

/**
 * Generate talking points with AI
 */
async function generateTalkingPoints(
  meetingTitle: string,
  company: Company | null,
  deal: Deal | null,
  lastMeetingNotes: string | null,
  attendees: string[]
): Promise<string[]> {
  if (!anthropicApiKey) {
    return [
      'Review any previous discussions and follow up on open items',
      'Understand their current priorities and challenges',
      'Identify next steps to move the conversation forward',
    ];
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0.5,
        system: 'You are a sales preparation assistant. Generate 3 specific talking points for an upcoming meeting. Return ONLY valid JSON.',
        messages: [{
          role: 'user',
          content: `Generate meeting prep talking points:

MEETING: ${meetingTitle}
COMPANY: ${company?.name || 'Unknown'}
${company?.industry ? `Industry: ${company.industry}` : ''}
${deal ? `DEAL: ${deal.title} - ${deal.stage} - $${deal.value?.toLocaleString()}` : ''}
ATTENDEES: ${attendees.join(', ')}
${lastMeetingNotes ? `PREVIOUS MEETING: ${lastMeetingNotes}` : ''}

Return JSON: { "talkingPoints": ["point1", "point2", "point3"] }`
        }],
      }),
    });

    if (!response.ok) {
      throw new Error('AI API error');
    }

    const result = await response.json();
    const content = result.content[0]?.text;
    const parsed = JSON.parse(content);
    return parsed.talkingPoints || [];
  } catch (error) {
    console.error('Error generating talking points:', error);
    return [
      'Review any previous discussions and follow up on open items',
      'Understand their current priorities and challenges',
      'Identify next steps to move the conversation forward',
    ];
  }
}

/**
 * Get Slack config for org
 */
async function getSlackConfig(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<{ botToken: string; deliveryMethod: string; channelId?: string } | null> {
  const { data: orgSettings } = await supabase
    .from('slack_org_settings')
    .select('bot_access_token')
    .eq('org_id', orgId)
    .eq('is_connected', true)
    .single();

  if (!orgSettings?.bot_access_token) return null;

  const { data: notifSettings } = await supabase
    .from('slack_notification_settings')
    .select('delivery_method, channel_id')
    .eq('org_id', orgId)
    .eq('feature', 'meeting_prep')
    .eq('is_enabled', true)
    .single();

  if (!notifSettings) return null;

  return {
    botToken: orgSettings.bot_access_token,
    deliveryMethod: notifSettings.delivery_method || 'dm',
    channelId: notifSettings.channel_id,
  };
}

/**
 * Get Slack user ID for a Sixty user
 */
async function getSlackUserId(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  sixtyUserId: string
): Promise<string | undefined> {
  const { data } = await supabase
    .from('slack_user_mappings')
    .select('slack_user_id')
    .eq('org_id', orgId)
    .eq('sixty_user_id', sixtyUserId)
    .single();

  return data?.slack_user_id;
}

/**
 * Get user profile
 */
async function getUserProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ fullName: string; email: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  return data ? { fullName: data.full_name || data.email || 'User', email: data.email || '' } : null;
}

/**
 * Send Slack DM
 */
async function sendSlackDM(
  botToken: string,
  userId: string,
  message: { blocks: unknown[]; text: string }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const openResponse = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: userId }),
  });

  const openResult = await openResponse.json();
  if (!openResult.ok) {
    return { ok: false, error: openResult.error };
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: openResult.channel.id,
      blocks: message.blocks,
      text: message.text,
    }),
  });

  return response.json();
}

/**
 * Post to Slack channel
 */
async function postToSlack(
  botToken: string,
  channel: string,
  message: { blocks: unknown[]; text: string }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      blocks: message.blocks,
      text: message.text,
    }),
  });

  return response.json();
}

/**
 * Process a single meeting prep
 */
async function processMeetingPrep(
  supabase: ReturnType<typeof createClient>,
  event: CalendarEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already sent
    const { data: existingSent } = await supabase
      .from('slack_notifications_sent')
      .select('id')
      .eq('org_id', event.org_id)
      .eq('feature', 'meeting_prep')
      .eq('entity_id', event.id)
      .limit(1);

    if (existingSent && existingSent.length > 0) {
      return { success: true }; // Already sent
    }

    // Get Slack config
    const slackConfig = await getSlackConfig(supabase, event.org_id);
    if (!slackConfig) {
      return { success: false, error: 'Slack not configured' };
    }

    // Get user profile
    const userProfile = await getUserProfile(supabase, event.user_id);
    if (!userProfile) {
      return { success: false, error: 'User not found' };
    }

    // Get Slack user ID
    const slackUserId = await getSlackUserId(supabase, event.org_id, event.user_id);

    // Get contacts from attendees
    const contacts = await getContactsByEmail(supabase, event.attendee_emails || []);

    // Get company from first contact
    let company: Company | null = null;
    if (contacts.length > 0) {
      company = await getCompanyForContact(supabase, contacts[0].id);
    }

    // Get deal
    let deal: Deal | null = null;
    if (company) {
      deal = await getDealForCompany(supabase, company.name, event.user_id);
    }

    // Get last meeting notes
    let lastMeetingData: { notes: string; date: string } | null = null;
    if (company) {
      lastMeetingData = await getLastMeetingNotes(supabase, company.name, event.user_id);
    }

    // Get recent activities
    let recentActivities = '';
    if (company) {
      recentActivities = await getRecentActivities(supabase, company.name, event.user_id);
    }

    // Generate talking points
    const talkingPoints = await generateTalkingPoints(
      event.title,
      company,
      deal,
      lastMeetingData?.notes || null,
      contacts.map(c => c.full_name || `${c.first_name} ${c.last_name}`.trim() || c.email || 'Unknown')
    );

    // Calculate days in pipeline
    let daysInPipeline: number | undefined;
    if (deal) {
      daysInPipeline = Math.ceil((Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24));
    }

    // Build prep data
    const prepData: MeetingPrepData = {
      meetingTitle: event.title,
      meetingId: event.id,
      userName: userProfile.fullName,
      slackUserId,
      attendees: contacts.map((c) => ({
        name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        title: c.title,
        isDecisionMaker: c.is_decision_maker,
      })),
      company: company || { name: 'Unknown Company' },
      deal: deal ? {
        name: deal.title,
        id: deal.id,
        value: deal.value,
        stage: deal.stage,
        winProbability: deal.win_probability,
        daysInPipeline,
      } : undefined,
      lastMeetingNotes: lastMeetingData?.notes,
      lastMeetingDate: lastMeetingData?.date,
      talkingPoints,
      meetingUrl: event.meeting_url || undefined,
      appUrl,
    };

    // Build and send message
    const message = buildMeetingPrepMessage(prepData);

    let result: { ok: boolean; ts?: string; error?: string };
    let recipientId: string;

    if (slackConfig.deliveryMethod === 'dm' && slackUserId) {
      result = await sendSlackDM(slackConfig.botToken, slackUserId, message);
      recipientId = slackUserId;
    } else if (slackConfig.channelId) {
      result = await postToSlack(slackConfig.botToken, slackConfig.channelId, message);
      recipientId = slackConfig.channelId;
    } else {
      return { success: false, error: 'No delivery target' };
    }

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    // Record sent notification
    await supabase.from('slack_notifications_sent').insert({
      org_id: event.org_id,
      feature: 'meeting_prep',
      entity_type: 'prep',
      entity_id: event.id,
      recipient_type: slackConfig.deliveryMethod === 'dm' ? 'user' : 'channel',
      recipient_id: recipientId,
      slack_ts: result.ts,
      slack_channel_id: recipientId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error processing meeting prep:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for manual trigger with specific event
    let targetEventId: string | null = null;
    let targetOrgId: string | null = null;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      targetEventId = body.eventId || null;
      targetOrgId = body.orgId || null;
    }

    let meetings: CalendarEvent[];

    if (targetEventId) {
      // Process specific event
      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, start_time, user_id, attendee_emails, meeting_url, org_id')
        .eq('id', targetEventId)
        .single();

      meetings = data ? [data] : [];
    } else {
      // Get upcoming meetings (25-35 mins from now)
      meetings = await getUpcomingMeetings(supabase, targetOrgId || undefined);
    }

    if (meetings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No upcoming meetings to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each meeting
    const results = await Promise.all(
      meetings.map((meeting) => processMeetingPrep(supabase, meeting))
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    console.log(`Meeting prep sent: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: meetings.length,
        successCount,
        failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meeting prep:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
