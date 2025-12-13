// supabase/functions/_shared/slackBlocks.ts
// Reusable Slack Block Kit builders for consistent message formatting
// Following the slack-blocks skill for sales assistant bots

/**
 * Slack Block Kit Types
 */
export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackMessage {
  blocks: SlackBlock[];
  text?: string; // Fallback text for notifications
}

/**
 * Slack Block Kit safety helpers (prevent "invalid_blocks")
 *
 * Slack limits:
 * - header plain_text: 150 chars
 * - section mrkdwn: 3000 chars
 * - section field: 2000 chars
 * - context mrkdwn: 2000 chars
 * - button text: 75 chars
 * - button value: 2000 chars
 */
const truncate = (value: string, max: number): string => {
  const v = String(value ?? '');
  if (v.length <= max) return v;
  if (max <= 1) return v.slice(0, max);
  return `${v.slice(0, max - 1)}…`;
};

const safeHeaderText = (text: string): string => truncate(text, 150);
const safeButtonText = (text: string): string => truncate(text, 75);
const safeMrkdwn = (text: string): string => truncate(text, 2800);
const safeFieldText = (text: string): string => truncate(text, 1900);
const safeContextMrkdwn = (text: string): string => truncate(text, 1900);
const safeButtonValue = (value: string): string => truncate(value, 1900);

export interface ActionItem {
  task: string;
  suggestedOwner?: string;
  dueInDays?: number;
  dealId?: string;
}

export interface MeetingDebriefData {
  meetingTitle: string;
  meetingId: string;
  attendees: string[];
  duration: number;
  dealName?: string;
  dealId?: string;
  dealStage?: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'challenging';
  sentimentScore: number;
  talkTimeRep: number;
  talkTimeCustomer: number;
  actionItems: ActionItem[];
  coachingInsight: string;
  keyQuotes?: string[];
  appUrl: string;
}

export interface DailyDigestData {
  teamName: string;
  date: string;
  currencyCode?: string;
  currencyLocale?: string;
  meetings: Array<{
    time: string;
    userName: string;
    slackUserId?: string;
    title: string;
    prepNote?: string;
    isImportant?: boolean;
  }>;
  overdueTasks: Array<{
    userName: string;
    slackUserId?: string;
    task: string;
    daysOverdue: number;
  }>;
  dueTodayTasks: Array<{
    userName: string;
    slackUserId?: string;
    task: string;
  }>;
  insights: string[];
  weekStats: {
    dealsCount: number;
    dealsValue: number;
    meetingsCount: number;
    activitiesCount: number;
    pipelineValue: number;
  };
  appUrl: string;
}

export interface MeetingPrepData {
  meetingTitle: string;
  meetingId: string;
  userName: string;
  slackUserId?: string;
  currencyCode?: string;
  currencyLocale?: string;
  attendees: Array<{
    name: string;
    title?: string;
    isDecisionMaker?: boolean;
    meetingCount?: number;
    isFirstMeeting?: boolean;
  }>;
  company: {
    name: string;
    industry?: string;
    size?: string;
    stage?: string;
  };
  deal?: {
    name: string;
    id: string;
    value: number;
    stage: string;
    winProbability?: number;
    daysInPipeline?: number;
  };
  lastMeetingNotes?: string;
  lastMeetingDate?: string;
  talkingPoints: string[];
  meetingUrl?: string;
  appUrl: string;
  meetingHistory?: Array<{
    date: string;
    title: string;
    outcome?: 'positive' | 'neutral' | 'negative';
    keyTopics?: string[];
  }>;
  riskSignals?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  previousObjections?: Array<{
    objection: string;
    resolution?: string;
    resolved: boolean;
  }>;
  stageQuestions?: string[];
  checklistReminders?: string[];
  scriptSteps?: Array<{
    stepName: string;
    topics: string[];
  }>;
}

export interface DealRoomData {
  dealName: string;
  dealId: string;
  dealValue: number;
  dealStage: string;
  currencyCode?: string;
  currencyLocale?: string;
  ownerName?: string;
  ownerSlackUserId?: string;
  winProbability?: number;
  companyName?: string;
  companyIndustry?: string;
  companySize?: string;
  company?: {
    name: string;
    industry?: string;
    size?: string;
    location?: string;
  };
  contacts?: Array<{
    name: string;
    title?: string;
    isDecisionMaker?: boolean;
  }>;
  keyContacts?: Array<{
    name: string;
    title?: string;
    isDecisionMaker?: boolean;
  }>;
  aiAssessment?: {
    winProbability: number;
    keyFactors: string[];
    risks: string[];
  };
  appUrl: string;
}

export interface DealStageChangeData {
  dealName: string;
  dealId: string;
  previousStage: string;
  newStage: string;
  updatedBy: string;
  slackUserId?: string;
  appUrl: string;
}

export interface DealActivityData {
  dealName: string;
  dealId: string;
  activityType: string;
  description: string;
  createdBy: string;
  slackUserId?: string;
  appUrl: string;
}

export interface WinProbabilityChangeData {
  dealName: string;
  dealId: string;
  previousProbability: number;
  newProbability: number;
  factors: string[];
  suggestedActions: string[];
  appUrl: string;
}

export interface DealWonData {
  dealName: string;
  dealId: string;
  dealValue: number;
  currencyCode?: string;
  currencyLocale?: string;
  companyName: string;
  closedBy: string;
  slackUserId?: string;
  daysInPipeline?: number;
  winningFactors?: string[];
  archiveImmediately?: boolean;
  appUrl: string;
}

export interface DealLostData {
  dealName: string;
  dealId: string;
  dealValue: number;
  currencyCode?: string;
  currencyLocale?: string;
  companyName: string;
  lostReason?: string;
  closedBy: string;
  slackUserId?: string;
  lessonsLearned?: string[];
  archiveImmediately?: boolean;
  appUrl: string;
}

/**
 * Format currency for Slack messages.
 *
 * Defaults to GBP/en-GB so we don't accidentally show USD/$.
 */
const formatCurrency = (value: number, currency: string = 'GBP', locale?: string): string => {
  const code = (currency || 'GBP').toUpperCase();
  const effectiveLocale = locale || (code === 'USD' ? 'en-US' : code === 'EUR' ? 'en-IE' : code === 'AUD' ? 'en-AU' : code === 'CAD' ? 'en-CA' : 'en-GB');
  return new Intl.NumberFormat(effectiveLocale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Get sentiment indicator
 */
const getSentimentBadge = (sentiment: string, score: number): string => {
  const emoji = sentiment === 'positive' ? '🟢' : sentiment === 'challenging' ? '🔴' : '🟡';
  return `${emoji} ${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} (${score}%)`;
};

/**
 * Get talk time indicator
 */
const getTalkTimeBadge = (repPercent: number): string => {
  // Ideal is 30-40% rep talk time
  if (repPercent >= 25 && repPercent <= 45) return `✅ ${repPercent}%`;
  return `⚠️ ${repPercent}%`;
};

// =============================================================================
// PRIMITIVE BLOCK BUILDERS
// =============================================================================

export const divider = (): SlackBlock => ({ type: 'divider' });

export const header = (text: string): SlackBlock => ({
  type: 'header',
  text: {
    type: 'plain_text',
    text: safeHeaderText(text),
    emoji: true,
  },
});

export const section = (text: string): SlackBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: safeMrkdwn(text),
  },
});

/**
 * Section with fields (key-value pairs) - great for data display
 */
export const sectionWithFields = (fields: Array<{ label: string; value: string }>): SlackBlock => ({
  type: 'section',
  fields: fields.slice(0, 10).map((f) => ({
    type: 'mrkdwn',
    text: safeFieldText(`*${f.label}*\n${f.value}`),
  })),
});

/**
 * Section with accessory button
 */
export const sectionWithButton = (
  text: string,
  buttonText: string,
  actionId: string,
  value: string,
  style?: 'primary' | 'danger'
): SlackBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: safeMrkdwn(text),
  },
  accessory: {
    type: 'button',
    text: {
      type: 'plain_text',
      text: safeButtonText(buttonText),
      emoji: true,
    },
    action_id: actionId,
    value: safeButtonValue(value),
    ...(style && { style }),
  },
});

/**
 * Section with image accessory
 */
export const sectionWithImage = (
  text: string,
  imageUrl: string,
  altText: string
): SlackBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: safeMrkdwn(text),
  },
  accessory: {
    type: 'image',
    image_url: imageUrl,
    alt_text: altText,
  },
});

export const context = (elements: string[]): SlackBlock => ({
  type: 'context',
  elements: elements.map((text) => ({
    type: 'mrkdwn',
    text: safeContextMrkdwn(text),
  })),
});

/**
 * Actions block with buttons (max 3 recommended for UX)
 */
export const actions = (
  buttons: Array<{
    text: string;
    actionId: string;
    value: string;
    style?: 'primary' | 'danger';
    url?: string;
  }>
): SlackBlock => ({
  type: 'actions',
  elements: buttons.slice(0, 5).map((btn) => ({
    type: 'button',
    text: {
      type: 'plain_text',
      text: safeButtonText(btn.text),
      emoji: true,
    },
    action_id: btn.actionId,
    // URL buttons should not have value (Slack can reject)
    ...(btn.url ? {} : { value: safeButtonValue(btn.value) }),
    ...(btn.style && { style: btn.style }),
    ...(btn.url && { url: btn.url }),
  })),
});

// =============================================================================
// MESSAGE BUILDERS
// =============================================================================

/**
 * Meeting Debrief - Post-call summary with AI analysis
 */
export const buildMeetingDebriefMessage = (data: MeetingDebriefData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  // Header with meeting title
  blocks.push(header(`🎯 Meeting Debrief: ${truncate(data.meetingTitle, 100)}`));

  // Key metrics as fields
  blocks.push(sectionWithFields([
    { label: 'Sentiment', value: getSentimentBadge(data.sentiment, data.sentimentScore) },
    { label: 'Duration', value: `${data.duration} mins` },
    { label: 'Rep Talk Time', value: getTalkTimeBadge(data.talkTimeRep) },
    { label: 'Customer', value: `${data.talkTimeCustomer}%` },
  ]));

  // Summary
  blocks.push(section(`*📝 Summary*\n${truncate(data.summary, 500)}`));

  blocks.push(divider());

  // Action Items (max 3 shown inline)
  if (data.actionItems.length > 0) {
    blocks.push(section('*✅ Action Items*'));
    
    data.actionItems.slice(0, 3).forEach((item, index) => {
      const ownerText = item.suggestedOwner ? ` → _${item.suggestedOwner}_` : '';
      const dueText = item.dueInDays ? ` (${item.dueInDays}d)` : '';
      const taskValue = JSON.stringify({
        title: truncate(item.task, 150),
        dealId: data.dealId,
        dueInDays: item.dueInDays || 3,
        meetingId: data.meetingId,
      });

      blocks.push(sectionWithButton(
        `• ${truncate(item.task, 180)}${ownerText}${dueText}`,
        '➕ Add',
        `add_task_${index}`,
        taskValue,
        'primary'
      ));
    });

    // Bulk action for multiple items
    if (data.actionItems.length > 1) {
      const allTasksValue = JSON.stringify({
        tasks: data.actionItems.slice(0, 5).map((item) => ({
          title: truncate(item.task, 150),
          dealId: data.dealId,
          dueInDays: item.dueInDays || 3,
          meetingId: data.meetingId,
        })),
      });

      blocks.push(actions([
        { text: `Add All ${data.actionItems.length} Tasks`, actionId: 'add_all_tasks', value: allTasksValue, style: 'primary' },
      ]));
    }

    blocks.push(divider());
  }

  // Coaching Insight
  if (data.coachingInsight) {
    blocks.push(section(`*💡 Coaching Tip*\n${truncate(data.coachingInsight, 400)}`));
  }

  // Key Quote (if available)
  if (data.keyQuotes && data.keyQuotes.length > 0) {
    blocks.push(context([`_"${truncate(data.keyQuotes[0], 200)}"_`]));
  }

  // Action buttons (max 3)
  const buttonRow: Array<{ text: string; actionId: string; value: string; url?: string; style?: 'primary' }> = [
    { text: '🎬 View Meeting', actionId: 'view_meeting', value: data.meetingId, url: `${data.appUrl}/meetings/${data.meetingId}`, style: 'primary' },
  ];

  if (data.dealId) {
    buttonRow.push({ text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` });
  }

  blocks.push(actions(buttonRow));

  return {
    blocks,
    text: `Meeting Debrief: ${truncate(data.meetingTitle, 60)} - ${truncate(data.summary, 80)}`,
  };
};

/**
 * Daily Digest - Morning standup summary
 */
export const buildDailyDigestMessage = (data: DailyDigestData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push(header(`☀️ Good Morning, ${truncate(data.teamName, 50)}!`));
  blocks.push(context([`📅 ${data.date}`]));

  // Quick Stats
  blocks.push(sectionWithFields([
    { label: '📊 Pipeline', value: formatCurrency(data.weekStats.pipelineValue, data.currencyCode, data.currencyLocale) },
    { label: '🎯 Meetings', value: `${data.meetings.length} today` },
    { label: '✅ Due Today', value: `${data.dueTodayTasks.length} tasks` },
    { label: '🔴 Overdue', value: `${data.overdueTasks.length} tasks` },
  ]));

  blocks.push(divider());

  // Today's Meetings (if any)
  if (data.meetings.length > 0) {
    const meetingLines = data.meetings.slice(0, 4).map((m) => {
      const userMention = m.slackUserId ? `<@${m.slackUserId}>` : m.userName;
      const important = m.isImportant ? '🔥 ' : '';
      return `${important}*${m.time}* ${userMention} - ${truncate(m.title, 80)}`;
    });

    blocks.push(section(`*📅 TODAY'S MEETINGS*\n${meetingLines.join('\n')}`));

    if (data.meetings.length > 4) {
      blocks.push(context([`+ ${data.meetings.length - 4} more meetings`]));
    }
  }

  // Tasks Needing Attention
  if (data.overdueTasks.length > 0) {
    const overdueLines = data.overdueTasks.slice(0, 3).map((t) => {
      const userMention = t.slackUserId ? `<@${t.slackUserId}>` : t.userName;
      return `🔴 ${userMention}: ${truncate(t.task, 60)} (${t.daysOverdue}d overdue)`;
    });

    blocks.push(section(`*🚨 OVERDUE TASKS*\n${overdueLines.join('\n')}`));
  }

  // AI Insights
  if (data.insights.length > 0) {
    blocks.push(divider());
    const insightLines = data.insights.slice(0, 3).map((insight) => `💡 ${truncate(insight, 150)}`);
    blocks.push(section(`*AI INSIGHTS*\n${insightLines.join('\n')}`));
  }

  // Week Stats Summary
  blocks.push(divider());
  blocks.push(context([
    `📈 This week: ${data.weekStats.dealsCount} deals closed (${formatCurrency(data.weekStats.dealsValue, data.currencyCode, data.currencyLocale)}) | ${data.weekStats.meetingsCount} meetings | ${data.weekStats.activitiesCount} activities`,
  ]));

  // Action button
  blocks.push(actions([
    { text: '📊 View Dashboard', actionId: 'view_dashboard', value: 'dashboard', url: `${data.appUrl}/dashboard`, style: 'primary' },
    { text: '📋 View Tasks', actionId: 'view_tasks', value: 'tasks', url: `${data.appUrl}/tasks` },
  ]));

  return {
    blocks,
    text: `Daily Digest for ${data.date} - ${data.meetings.length} meetings, ${data.overdueTasks.length} overdue tasks`,
  };
};

/**
 * Meeting Prep - Pre-meeting intelligence card
 */
export const buildMeetingPrepMessage = (data: MeetingPrepData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  // Header with user mention
  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.userName;
  blocks.push(header(`📅 Meeting in 15 mins`));
  blocks.push(section(`*${truncate(data.meetingTitle, 100)}*\n${userMention}`));

  // Risk Alerts (if critical/high)
  const criticalRisks = data.riskSignals?.filter(r => r.severity === 'critical' || r.severity === 'high') || [];
  if (criticalRisks.length > 0) {
    const riskEmoji = criticalRisks.some(r => r.severity === 'critical') ? '🚨' : '⚠️';
    const riskLines = criticalRisks.slice(0, 2).map(r => {
      const badge = r.severity === 'critical' ? '🔴' : '🟠';
      return `${badge} ${truncate(r.description, 100)}`;
    });
    blocks.push(section(`${riskEmoji} *DEAL RISKS*\n${riskLines.join('\n')}`));
  }

  blocks.push(divider());

  // Key info as fields
  const fields: Array<{ label: string; value: string }> = [];
  
  if (data.attendees.length > 0) {
    const keyAttendee = data.attendees.find(a => a.isDecisionMaker) || data.attendees[0];
    const badge = keyAttendee.isDecisionMaker ? ' 🎯' : '';
    fields.push({ label: 'With', value: `${keyAttendee.name}${keyAttendee.title ? ` (${keyAttendee.title})` : ''}${badge}` });
  }

  fields.push({ label: 'Company', value: data.company.name });

  if (data.deal) {
    fields.push({ label: 'Deal', value: `${formatCurrency(data.deal.value, data.currencyCode, data.currencyLocale)} - ${data.deal.stage}` });
    if (data.deal.winProbability !== undefined) {
      fields.push({ label: 'Win Prob', value: `${data.deal.winProbability}%` });
    }
  }

  if (fields.length > 0) {
    blocks.push(sectionWithFields(fields));
  }

  // Quick Prep Notes
  const prepItems: string[] = [];
  
  if (data.lastMeetingNotes) {
    prepItems.push(`📝 Last meeting: _"${truncate(data.lastMeetingNotes, 120)}"_`);
  }

  // Unresolved objections
  const unresolvedObjections = data.previousObjections?.filter(o => !o.resolved) || [];
  if (unresolvedObjections.length > 0) {
    prepItems.push(`⚠️ Open objection: ${truncate(unresolvedObjections[0].objection, 100)}`);
  }

  // Key talking point
  if (data.talkingPoints.length > 0) {
    prepItems.push(`🎯 Key point: ${truncate(data.talkingPoints[0], 100)}`);
  }

  if (prepItems.length > 0) {
    blocks.push(section(`*Quick Prep:*\n${prepItems.join('\n')}`));
  }

  // Action buttons (max 3)
  const buttonRow: Array<{ text: string; actionId: string; value: string; url?: string; style?: 'primary' }> = [];

  if (data.meetingUrl) {
    buttonRow.push({ text: '🎥 Join Call', actionId: 'join_meeting', value: data.meetingId, url: data.meetingUrl, style: 'primary' });
  }

  if (data.deal) {
    buttonRow.push({ text: '💼 View Deal', actionId: 'view_deal', value: data.deal.id, url: `${data.appUrl}/deals/${data.deal.id}` });
  }

  buttonRow.push({ text: '📋 Full Prep', actionId: 'view_meeting', value: data.meetingId, url: `${data.appUrl}/meetings/${data.meetingId}` });

  blocks.push(actions(buttonRow.slice(0, 3)));

  // Context
  if (data.attendees.length > 1) {
    blocks.push(context([`👥 ${data.attendees.length} attendees • ${data.company.industry || 'Company'}`]));
  }

  return {
    blocks,
    text: `Meeting Prep: ${data.meetingTitle} in 15 minutes`,
  };
};

/**
 * Deal Room - Initial channel message
 */
export const buildDealRoomMessage = (data: DealRoomData): SlackMessage => {
  const blocks: SlackBlock[] = [];
  const companyName = data.companyName || data.company?.name || 'Unknown Company';
  const ownerMention = data.ownerSlackUserId ? `<@${data.ownerSlackUserId}>` : (data.ownerName || 'Unknown');
  const hasWinProb = data.winProbability !== undefined && data.winProbability !== null;

  // Header
  blocks.push(header(`💰 ${truncate(companyName, 80)} Deal Room`));

  // Key deal info as fields
  blocks.push(sectionWithFields([
    { label: 'Value', value: formatCurrency(data.dealValue, data.currencyCode, data.currencyLocale) },
    { label: 'Stage', value: data.dealStage },
    { label: 'Owner', value: ownerMention },
    { label: 'Win Prob', value: hasWinProb ? `${data.winProbability}%` : 'TBD' },
  ]));

  blocks.push(divider());

  // Company Info
  const industry = data.companyIndustry || data.company?.industry;
  const size = data.companySize || data.company?.size;
  const location = data.company?.location;

  const companyDetails = [industry, size, location].filter(Boolean).join(' • ');
  if (companyDetails) {
    blocks.push(section(`*🏢 Company*\n${companyDetails}`));
  }

  // Key Contacts
  const contacts = data.keyContacts || data.contacts || [];
  if (contacts.length > 0) {
    const contactLines = contacts.slice(0, 3).map((c) => {
      const badge = c.isDecisionMaker ? ' 🎯' : '';
      return `• *${c.name}*${c.title ? ` (${c.title})` : ''}${badge}`;
    });
    blocks.push(section(`*👥 Key Contacts*\n${contactLines.join('\n')}`));
  }

  // AI Assessment
  if (data.aiAssessment) {
    blocks.push(divider());
    const assessmentLines: string[] = [];
    if (data.aiAssessment.keyFactors?.length > 0) {
      assessmentLines.push(`✅ ${data.aiAssessment.keyFactors.slice(0, 2).join(', ')}`);
    }
    if (data.aiAssessment.risks?.length > 0) {
      assessmentLines.push(`⚠️ ${data.aiAssessment.risks.slice(0, 2).join(', ')}`);
    }
    if (assessmentLines.length > 0) {
      blocks.push(section(`*🤖 AI Assessment*\n${assessmentLines.join('\n')}`));
    }
  }

  // Action buttons
  blocks.push(actions([
    { text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}`, style: 'primary' },
    { text: '📝 Log Activity', actionId: 'log_activity', value: data.dealId },
  ]));

  // Context
  blocks.push(context([`Created ${new Date().toLocaleDateString()} • Updates will be posted here`]));

  return {
    blocks,
    text: `Deal Room: ${companyName} - ${formatCurrency(data.dealValue, data.currencyCode, data.currencyLocale)}`,
  };
};

export const buildDealRoomWelcomeMessage = (data: DealRoomData): SlackMessage => {
  return buildDealRoomMessage(data);
};

/**
 * Deal Stage Change - Pipeline movement notification
 */
export const buildDealStageChangeMessage = (data: DealStageChangeData): SlackMessage => {
  const blocks: SlackBlock[] = [];
  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.updatedBy;

  // Determine if this is progress or regression
  const stages = ['sql', 'opportunity', 'verbal', 'signed'];
  const prevIndex = stages.indexOf(data.previousStage.toLowerCase());
  const newIndex = stages.indexOf(data.newStage.toLowerCase());
  const isProgress = newIndex > prevIndex;
  const emoji = isProgress ? '🚀' : '⚠️';

  blocks.push(section(`${emoji} *Stage Update*\n*${data.dealName}*\n${data.previousStage} → *${data.newStage}*`));

  blocks.push(context([`Updated by ${userMention} • Just now`]));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    ]));
  }

  return {
    blocks,
    text: `Stage Update: ${data.dealName} → ${data.newStage}`,
  };
};

/**
 * Deal Activity - Activity logged notification
 */
export const buildDealActivityMessage = (data: DealActivityData): SlackMessage => {
  const blocks: SlackBlock[] = [];
  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.createdBy;

  const activityEmoji: Record<string, string> = {
    'call': '📞',
    'email': '📧',
    'meeting': '📅',
    'proposal': '📝',
    'note': '📌',
    'task': '✅',
    'demo': '🎬',
  };
  const emoji = activityEmoji[data.activityType.toLowerCase()] || '📢';

  blocks.push(section(`${emoji} *${data.activityType}* by ${userMention}\n\n${truncate(data.description, 300)}`));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    ]));
  }

  return {
    blocks,
    text: `${data.activityType}: ${truncate(data.description, 100)}`,
  };
};

/**
 * Win Probability Change - Risk alert
 */
export const buildWinProbabilityChangeMessage = (data: WinProbabilityChangeData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  const change = data.newProbability - data.previousProbability;
  const isIncrease = change > 0;
  const emoji = isIncrease ? '📈' : '⚠️';
  const direction = isIncrease ? '↑' : '↓';
  const headerEmoji = isIncrease ? '🟢' : '🔴';

  blocks.push(header(`${headerEmoji} Win Probability ${isIncrease ? 'Increased' : 'Dropped'}`));

  blocks.push(sectionWithFields([
    { label: 'Deal', value: truncate(data.dealName, 60) },
    { label: 'Change', value: `${data.previousProbability}% → ${data.newProbability}% (${direction}${Math.abs(change)}%)` },
  ]));

  if (data.factors && data.factors.length > 0) {
    blocks.push(section(`*${isIncrease ? '✅ Positive Signals' : '⚠️ Risk Factors'}*\n${data.factors.slice(0, 3).map(f => `• ${truncate(f, 100)}`).join('\n')}`));
  }

  if (!isIncrease && data.suggestedActions && data.suggestedActions.length > 0) {
    blocks.push(section(`*🎯 Suggested Actions*\n${data.suggestedActions.slice(0, 3).map(a => `• ${truncate(a, 100)}`).join('\n')}`));
  }

  const buttonRow: Array<{ text: string; actionId: string; value: string; url?: string; style?: 'primary' | 'danger' }> = [];

  if (data.dealId && data.appUrl) {
    buttonRow.push({ text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}`, style: 'primary' });
  }
  if (!isIncrease) {
    buttonRow.push({ text: '📝 Create Task', actionId: 'create_task_from_alert', value: JSON.stringify({ dealId: data.dealId, type: 'win_probability' }) });
  }

  blocks.push(actions(buttonRow.slice(0, 3)));

  return {
    blocks,
    text: `Win Probability ${isIncrease ? 'increased' : 'dropped'}: ${data.dealName} ${data.previousProbability}% → ${data.newProbability}%`,
  };
};

/**
 * Deal Won - Celebration message
 */
export const buildDealWonMessage = (data: DealWonData): SlackMessage => {
  const blocks: SlackBlock[] = [];
  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.closedBy;

  // Celebratory header
  blocks.push(header(`🎉 DEAL WON!`));

  // Main announcement
  blocks.push(section(`*${data.companyName}* just signed!\n\n💰 *${formatCurrency(data.dealValue, data.currencyCode, data.currencyLocale)}* Contract${data.daysInPipeline ? `\n⏱️ *${data.daysInPipeline} days* in pipeline` : ''}`));

  blocks.push(divider());

  // Winning factors (if provided)
  if (data.winningFactors && data.winningFactors.length > 0) {
    const factorLines = data.winningFactors.slice(0, 3).map(f => `✅ ${truncate(f, 80)}`);
    blocks.push(section(`*Winning Factors*\n${factorLines.join('\n')}`));
  }

  // Context
  blocks.push(context([`Closed by ${userMention} • 🏆 Great work!`]));

  // Action buttons
  blocks.push(actions([
    { text: '🎊 Celebrate', actionId: 'celebrate_deal', value: data.dealId, style: 'primary' },
    { text: '📝 Case Study', actionId: 'create_case_study', value: data.dealId },
    { text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
  ]));

  return {
    blocks,
    text: `🎉 Deal Won! ${data.companyName} - ${formatCurrency(data.dealValue, data.currencyCode, data.currencyLocale)}`,
  };
};

/**
 * Deal Lost - Respectful close notification
 */
export const buildDealLostMessage = (data: DealLostData): SlackMessage => {
  const blocks: SlackBlock[] = [];
  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.closedBy;

  blocks.push(section(`😔 *Deal Lost*\n\n*${data.companyName}* - ${formatCurrency(data.dealValue, data.currencyCode, data.currencyLocale)}`));

  if (data.lostReason) {
    blocks.push(section(`*Reason:* ${truncate(data.lostReason, 200)}`));
  }

  // Lessons learned (if provided)
  if (data.lessonsLearned && data.lessonsLearned.length > 0) {
    const lessonLines = data.lessonsLearned.slice(0, 2).map(l => `📝 ${truncate(l, 100)}`);
    blocks.push(section(`*Takeaways*\n${lessonLines.join('\n')}`));
  }

  blocks.push(context([`Closed by ${userMention} • This channel will be archived`]));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: '💼 View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    ]));
  }

  return {
    blocks,
    text: `Deal Lost: ${data.companyName} - ${formatCurrency(data.dealValue, data.currencyCode, data.currencyLocale)}`,
  };
};

/**
 * Task confirmation (ephemeral response)
 */
export const buildTaskAddedConfirmation = (taskTitle: string, count: number = 1): SlackMessage => {
  const message = count === 1
    ? `✅ Task added: "${truncate(taskTitle, 60)}"`
    : `✅ ${count} tasks added to your task list!`;

  return {
    blocks: [section(message)],
    text: message,
  };
};
