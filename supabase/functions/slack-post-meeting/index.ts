// supabase/functions/slack-post-meeting/index.ts
// Posts AI Meeting Debrief to Slack when a meeting transcript is indexed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { buildMeetingDebriefMessage, type MeetingDebriefData } from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://use60.com';

interface MeetingData {
  id: string;
  title: string;
  transcript?: string;
  summary?: string;
  duration_minutes?: number;
  attendees?: string[];
  owner_user_id: string;
  org_id?: string;
  deal_id?: string;
  deal?: {
    id: string;
    title: string;
    stage: string;
    value: number;
  };
}

/**
 * Call Anthropic API for meeting analysis
 */
async function analyzeMeeting(meeting: MeetingData): Promise<{
  summary: string;
  sentiment: 'positive' | 'neutral' | 'challenging';
  sentimentScore: number;
  talkTimeRep: number;
  talkTimeCustomer: number;
  actionItems: Array<{ task: string; suggestedOwner?: string; dueInDays: number }>;
  coachingInsight: string;
  keyQuotes: string[];
}> {
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const transcript = meeting.transcript || meeting.summary || 'No transcript available';
  const attendees = meeting.attendees?.join(', ') || 'Unknown attendees';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      temperature: 0.5,
      system: `You are a sales meeting analyst creating concise Slack notifications for sales teams.
Your goal is to provide an actionable meeting summary that helps:
1. Sales managers quickly understand meeting outcomes without watching recordings
2. Sales reps get immediate coaching feedback
3. Teams stay aligned on deal progress

Focus on brevity, action-orientation, and constructive coaching.
Return ONLY valid JSON with no additional text.`,
      messages: [{
        role: 'user',
        content: `Analyze this sales meeting and provide a Slack-ready summary:

MEETING: ${meeting.title}
ATTENDEES: ${attendees}
DURATION: ${meeting.duration_minutes || 30} minutes
${meeting.deal ? `DEAL: ${meeting.deal.title} (Stage: ${meeting.deal.stage}, Value: $${meeting.deal.value?.toLocaleString()})` : ''}

TRANSCRIPT:
${transcript.substring(0, 15000)}

Return your analysis as JSON with this exact structure:
{
  "summary": "2-3 sentence summary of the meeting",
  "sentiment": "positive" | "neutral" | "challenging",
  "sentimentScore": 0-100,
  "talkTimeRep": 0-100,
  "talkTimeCustomer": 0-100,
  "actionItems": [{ "task": "string", "suggestedOwner": "string", "dueInDays": 1-14 }],
  "coachingInsight": "One specific tip for the sales rep",
  "keyQuotes": ["Notable customer quote"]
}`
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text;

  try {
    return JSON.parse(content);
  } catch {
    console.error('Failed to parse AI response:', content);
    // Return default structure
    return {
      summary: meeting.summary || 'Meeting summary unavailable',
      sentiment: 'neutral',
      sentimentScore: 50,
      talkTimeRep: 40,
      talkTimeCustomer: 60,
      actionItems: [],
      coachingInsight: 'Review the meeting recording for detailed insights.',
      keyQuotes: [],
    };
  }
}

/**
 * Get Slack bot token for org
 */
async function getSlackConfig(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<{ botToken: string; settings: { channelId?: string; deliveryMethod: string } } | null> {
  // Get org Slack settings
  const { data: orgSettings } = await supabase
    .from('slack_org_settings')
    .select('bot_access_token')
    .eq('org_id', orgId)
    .eq('is_connected', true)
    .single();

  if (!orgSettings?.bot_access_token) {
    console.log('No Slack connection for org:', orgId);
    return null;
  }

  // Get notification settings for meeting_debrief
  const { data: notifSettings } = await supabase
    .from('slack_notification_settings')
    .select('channel_id, delivery_method')
    .eq('org_id', orgId)
    .eq('feature', 'meeting_debrief')
    .eq('is_enabled', true)
    .single();

  if (!notifSettings) {
    console.log('Meeting debrief notifications not enabled for org:', orgId);
    return null;
  }

  return {
    botToken: orgSettings.bot_access_token,
    settings: {
      channelId: notifSettings.channel_id,
      deliveryMethod: notifSettings.delivery_method || 'channel',
    },
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
 * Post message to Slack
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
 * Send DM to Slack user
 */
async function sendSlackDM(
  botToken: string,
  userId: string,
  message: { blocks: unknown[]; text: string }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  // Open DM channel
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

  // Send message to DM channel
  return postToSlack(botToken, openResult.channel.id, message);
}

/**
 * Record sent notification
 */
async function recordNotification(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  meetingId: string,
  recipientType: string,
  recipientId: string,
  slackTs: string,
  channelId: string
): Promise<void> {
  await supabase.from('slack_notifications_sent').insert({
    org_id: orgId,
    feature: 'meeting_debrief',
    entity_type: 'meeting',
    entity_id: meetingId,
    recipient_type: recipientType,
    recipient_id: recipientId,
    slack_ts: slackTs,
    slack_channel_id: channelId,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, orgId } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'meetingId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch meeting data
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        transcript,
        summary,
        duration_minutes,
        attendees,
        owner_user_id,
        org_id,
        deal_id,
        deals:deal_id (
          id,
          title,
          stage,
          value
        )
      `)
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('Meeting not found:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveOrgId = orgId || meeting.org_id;
    if (!effectiveOrgId) {
      return new Response(
        JSON.stringify({ error: 'Org ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already sent
    const { data: existingSent } = await supabase
      .from('slack_notifications_sent')
      .select('id')
      .eq('org_id', effectiveOrgId)
      .eq('feature', 'meeting_debrief')
      .eq('entity_id', meetingId)
      .limit(1);

    if (existingSent && existingSent.length > 0) {
      console.log('Meeting debrief already sent for:', meetingId);
      return new Response(
        JSON.stringify({ success: true, message: 'Already sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Slack configuration
    const slackConfig = await getSlackConfig(supabase, effectiveOrgId);
    if (!slackConfig) {
      return new Response(
        JSON.stringify({ success: false, message: 'Slack not configured or feature disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze meeting with AI
    console.log('Analyzing meeting:', meetingId);
    const analysis = await analyzeMeeting({
      ...meeting,
      deal: meeting.deals as MeetingData['deal'],
    });

    // Build Slack message
    const debriefData: MeetingDebriefData = {
      meetingTitle: meeting.title || 'Untitled Meeting',
      meetingId: meeting.id,
      attendees: meeting.attendees || [],
      duration: meeting.duration_minutes || 30,
      dealName: (meeting.deals as { title?: string })?.title,
      dealId: meeting.deal_id || undefined,
      dealStage: (meeting.deals as { stage?: string })?.stage,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      sentimentScore: analysis.sentimentScore,
      talkTimeRep: analysis.talkTimeRep,
      talkTimeCustomer: analysis.talkTimeCustomer,
      actionItems: analysis.actionItems,
      coachingInsight: analysis.coachingInsight,
      appUrl,
    };

    const slackMessage = buildMeetingDebriefMessage(debriefData);

    // Send to Slack
    let result: { ok: boolean; ts?: string; error?: string };
    let recipientId: string;
    let recipientType: string;
    let channelId: string;

    if (slackConfig.settings.deliveryMethod === 'dm') {
      // Send DM to meeting owner
      const ownerSlackId = await getSlackUserId(supabase, effectiveOrgId, meeting.owner_user_id);
      if (!ownerSlackId) {
        console.log('No Slack mapping for meeting owner');
        return new Response(
          JSON.stringify({ success: false, message: 'Owner not mapped to Slack' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = await sendSlackDM(slackConfig.botToken, ownerSlackId, slackMessage);
      recipientId = ownerSlackId;
      recipientType = 'user';
      channelId = ownerSlackId; // DM channel
    } else {
      // Send to channel
      if (!slackConfig.settings.channelId) {
        return new Response(
          JSON.stringify({ success: false, message: 'No channel configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = await postToSlack(slackConfig.botToken, slackConfig.settings.channelId, slackMessage);
      recipientId = slackConfig.settings.channelId;
      recipientType = 'channel';
      channelId = slackConfig.settings.channelId;
    }

    if (!result.ok) {
      console.error('Slack API error:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the notification
    await recordNotification(
      supabase,
      effectiveOrgId,
      meetingId,
      recipientType,
      recipientId,
      result.ts || '',
      channelId
    );

    console.log('Meeting debrief posted successfully:', meetingId);
    return new Response(
      JSON.stringify({ success: true, slackTs: result.ts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error posting meeting debrief:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
