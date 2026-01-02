// supabase/functions/slack-slash-commands/handlers/debrief.ts
// Handler for /sixty debrief [last|today|<name>] - Post-meeting summary

import { buildMeetingDebriefMessage, type MeetingDebriefData, type SlackMessage, type ActionItem } from '../../_shared/slackBlocks.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  owner_user_id: string;
  transcript_text?: string;
  summary?: string;
  attendee_emails?: string[];
  sentiment_score?: number;
  talk_time_rep?: number;
  talk_time_customer?: number;
  action_items?: ActionItem[];
  coaching_insights?: string;
  key_quotes?: string[];
}

interface MeetingClassification {
  outcome?: 'positive' | 'neutral' | 'negative';
  next_steps?: string[];
}

/**
 * Handle /sixty debrief [target] command
 * Target can be: "last" (default), "today", or a meeting name search
 */
export async function handleDebrief(ctx: CommandContext, target: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  const targetLower = target.toLowerCase().trim();

  try {
    let meeting: Meeting | null = null;

    if (targetLower === 'last' || targetLower === '') {
      // Get most recent completed meeting
      meeting = await getLastMeeting(ctx, userId);
    } else if (targetLower === 'today') {
      // Get today's completed meetings and show picker if multiple
      const todayMeetings = await getTodayCompletedMeetings(ctx, userId);

      if (todayMeetings.length === 0) {
        return buildErrorResponse('No completed meetings found for today.\n\nMeetings need to have a transcript or summary to generate a debrief.');
      }

      if (todayMeetings.length === 1) {
        meeting = todayMeetings[0];
      } else {
        // Multiple meetings - show picker
        return buildMeetingPickerResponse(todayMeetings, 'debrief');
      }
    } else {
      // Search for meeting by name
      meeting = await searchMeetingByName(ctx, userId, targetLower);
    }

    if (!meeting) {
      return buildErrorResponse(
        targetLower === 'last'
          ? 'No recent meetings with summaries found.\n\nMake sure your meetings are synced and have transcripts.'
          : `No meeting found matching "${target}".\n\nTry:\n• \`/sixty debrief last\` for your last meeting\n• \`/sixty debrief today\` to pick from today's meetings`
      );
    }

    // Check if meeting has content
    if (!meeting.summary && !meeting.transcript_text) {
      return buildErrorResponse(
        `Meeting "${meeting.title}" doesn't have a summary yet.\n\nSummaries are generated automatically after meetings are transcribed.`
      );
    }

    // Build debrief data
    const debriefData = await buildDebriefData(ctx, meeting);
    return buildMeetingDebriefMessage(debriefData);

  } catch (error) {
    console.error('Error in handleDebrief:', error);
    return buildErrorResponse('Failed to generate meeting debrief. Please try again.');
  }
}

/**
 * Get the most recent completed meeting with summary
 */
async function getLastMeeting(ctx: CommandContext, userId: string): Promise<Meeting | null> {
  const now = new Date();

  const { data } = await ctx.supabase
    .from('meetings')
    .select(`
      id, title, start_time, end_time, owner_user_id,
      transcript_text, summary, attendee_emails,
      sentiment_score, talk_time_rep, talk_time_customer,
      action_items, coaching_insights, key_quotes
    `)
    .eq('owner_user_id', userId)
    .lt('end_time', now.toISOString())
    .or('summary.not.is.null,transcript_text.not.is.null')
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as Meeting | null;
}

/**
 * Get today's completed meetings
 */
async function getTodayCompletedMeetings(ctx: CommandContext, userId: string): Promise<Meeting[]> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await ctx.supabase
    .from('meetings')
    .select(`
      id, title, start_time, end_time, owner_user_id,
      transcript_text, summary, attendee_emails,
      sentiment_score, talk_time_rep, talk_time_customer,
      action_items, coaching_insights, key_quotes
    `)
    .eq('owner_user_id', userId)
    .gte('start_time', todayStart.toISOString())
    .lt('end_time', now.toISOString())
    .or('summary.not.is.null,transcript_text.not.is.null')
    .order('end_time', { ascending: false });

  return (data || []) as Meeting[];
}

/**
 * Search for meeting by name
 */
async function searchMeetingByName(ctx: CommandContext, userId: string, query: string): Promise<Meeting | null> {
  const { data } = await ctx.supabase
    .from('meetings')
    .select(`
      id, title, start_time, end_time, owner_user_id,
      transcript_text, summary, attendee_emails,
      sentiment_score, talk_time_rep, talk_time_customer,
      action_items, coaching_insights, key_quotes
    `)
    .eq('owner_user_id', userId)
    .or('summary.not.is.null,transcript_text.not.is.null')
    .ilike('title', `%${query}%`)
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as Meeting | null;
}

/**
 * Build response for meeting picker (when multiple today)
 */
function buildMeetingPickerResponse(meetings: Meeting[], action: string): SlackMessage {
  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 Select a Meeting', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You have ${meetings.length} meetings today with summaries. Select one for a debrief:`,
      },
    },
    { type: 'divider' },
  ];

  // Add meeting buttons (max 5)
  meetings.slice(0, 5).forEach(meeting => {
    const endTime = new Date(meeting.end_time);
    const timeStr = endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${timeStr}* - ${meeting.title}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Get Debrief', emoji: true },
        action_id: 'debrief_meeting_select',
        value: meeting.id,
      },
    });
  });

  return {
    blocks,
    text: `Select a meeting for debrief - ${meetings.length} meetings today`,
  };
}

/**
 * Build complete debrief data
 */
async function buildDebriefData(ctx: CommandContext, meeting: Meeting): Promise<MeetingDebriefData> {
  const { supabase, appUrl } = ctx;

  // Parse attendee emails
  const attendees = parseAttendeeNames(meeting.attendee_emails);

  // Calculate duration
  const startTime = new Date(meeting.start_time);
  const endTime = new Date(meeting.end_time);
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  // Get deal info if we can match by attendee company
  let dealInfo: { id: string; name: string; stage: string } | undefined;
  if (attendees.length > 0) {
    const companyName = extractCompanyFromEmails(meeting.attendee_emails);
    if (companyName) {
      const { data: deal } = await supabase
        .from('deals')
        .select('id, name, deal_stages ( name )')
        .or(`company.ilike.%${companyName}%,name.ilike.%${companyName}%`)
        .not('status', 'eq', 'closed_won')
        .not('status', 'eq', 'closed_lost')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deal) {
        dealInfo = {
          id: deal.id,
          name: deal.name,
          stage: (deal as any).deal_stages?.name || 'Active',
        };
      }
    }
  }

  // Get meeting classification for sentiment if not available
  let sentiment: 'positive' | 'neutral' | 'challenging' = 'neutral';
  if (meeting.sentiment_score !== undefined && meeting.sentiment_score !== null) {
    if (meeting.sentiment_score >= 0.6) sentiment = 'positive';
    else if (meeting.sentiment_score <= 0.4) sentiment = 'challenging';
  } else {
    // Try to get from meeting_classifications
    const { data: classification } = await supabase
      .from('meeting_classifications')
      .select('outcome')
      .eq('meeting_id', meeting.id)
      .maybeSingle();

    if (classification?.outcome === 'positive') sentiment = 'positive';
    else if (classification?.outcome === 'negative') sentiment = 'challenging';
  }

  // Parse action items
  let actionItems: ActionItem[] = [];
  if (meeting.action_items) {
    if (Array.isArray(meeting.action_items)) {
      actionItems = meeting.action_items.map((item: any) => ({
        task: typeof item === 'string' ? item : item.task || item.title || String(item),
        dueInDays: item.dueInDays || item.due_in_days || 3,
        suggestedOwner: item.suggestedOwner || item.suggested_owner,
      }));
    }
  }

  // Generate default action items if none exist
  if (actionItems.length === 0 && meeting.summary) {
    actionItems = [
      { task: 'Send follow-up email with meeting notes', dueInDays: 1 },
      { task: 'Review and add any additional action items', dueInDays: 2 },
    ];
  }

  const debriefData: MeetingDebriefData = {
    meetingId: meeting.id,
    meetingTitle: meeting.title || 'Meeting',
    attendees,
    duration: durationMinutes,
    summary: meeting.summary || 'No summary available. View the meeting for full details.',
    sentiment,
    sentimentScore: meeting.sentiment_score || 0.5,
    talkTimeRep: meeting.talk_time_rep || 50,
    talkTimeCustomer: meeting.talk_time_customer || 50,
    actionItems,
    coachingInsight: meeting.coaching_insights || generateDefaultCoachingInsight(sentiment),
    keyQuotes: meeting.key_quotes || undefined,
    dealName: dealInfo?.name,
    dealId: dealInfo?.id,
    dealStage: dealInfo?.stage,
    appUrl,
  };

  return debriefData;
}

/**
 * Parse attendee names from emails
 */
function parseAttendeeNames(attendeeEmails: unknown): string[] {
  if (!attendeeEmails) return [];
  if (!Array.isArray(attendeeEmails)) return [];

  return attendeeEmails.map(email => {
    if (typeof email === 'string') {
      const name = email.split('@')[0];
      return name.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (typeof email === 'object' && email !== null) {
      return (email as any).name || (email as any).email?.split('@')[0] || 'Attendee';
    }
    return 'Attendee';
  }).slice(0, 5);
}

/**
 * Extract company name from email domains
 */
function extractCompanyFromEmails(emails: unknown): string | null {
  if (!emails || !Array.isArray(emails)) return null;

  for (const email of emails) {
    const emailStr = typeof email === 'string' ? email : (email as any)?.email;
    if (!emailStr) continue;

    const domain = emailStr.split('@')[1];
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain.toLowerCase())) {
      const company = domain.split('.')[0];
      return company.charAt(0).toUpperCase() + company.slice(1);
    }
  }
  return null;
}

/**
 * Generate default coaching insight based on sentiment
 */
function generateDefaultCoachingInsight(sentiment: 'positive' | 'neutral' | 'challenging'): string {
  switch (sentiment) {
    case 'positive':
      return 'Great energy in this meeting! Consider striking while the momentum is hot with a follow-up.';
    case 'challenging':
      return 'This meeting had some friction. Consider addressing concerns directly in your follow-up.';
    default:
      return 'Review the summary and identify 2-3 key points to reinforce in your follow-up.';
  }
}
