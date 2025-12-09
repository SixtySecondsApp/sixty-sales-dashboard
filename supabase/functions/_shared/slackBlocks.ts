// supabase/functions/_shared/slackBlocks.ts
// Reusable Slack Block Kit builders for consistent message formatting

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
  appUrl: string;
}

export interface DailyDigestData {
  teamName: string;
  date: string;
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
}

export interface DealRoomData {
  dealName: string;
  dealId: string;
  dealValue: number;
  dealStage: string;
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
  companyName: string;
  closedBy: string;
  slackUserId?: string;
  daysInPipeline?: number;
  archiveImmediately?: boolean;
  appUrl: string;
}

export interface DealLostData {
  dealName: string;
  dealId: string;
  dealValue: number;
  companyName: string;
  lostReason?: string;
  closedBy: string;
  slackUserId?: string;
  archiveImmediately?: boolean;
  appUrl: string;
}

/**
 * Emoji helpers
 */
const getSentimentEmoji = (sentiment: string): string => {
  switch (sentiment) {
    case 'positive': return '😊';
    case 'neutral': return '😐';
    case 'challenging': return '😰';
    default: return '📊';
  }
};

const getTalkTimeEmoji = (repPercent: number): string => {
  // Ideal is 30-40% rep talk time
  if (repPercent >= 25 && repPercent <= 45) return '✅';
  if (repPercent < 25) return '⚠️'; // Too quiet
  return '⚠️'; // Talking too much
};

/**
 * Format currency
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Create a divider block
 */
export const divider = (): SlackBlock => ({ type: 'divider' });

/**
 * Create a header block
 */
export const header = (text: string): SlackBlock => ({
  type: 'header',
  text: {
    type: 'plain_text',
    text,
    emoji: true,
  },
});

/**
 * Create a section block with markdown
 */
export const section = (text: string): SlackBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text,
  },
});

/**
 * Create a section with an accessory button
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
    text,
  },
  accessory: {
    type: 'button',
    text: {
      type: 'plain_text',
      text: buttonText,
      emoji: true,
    },
    action_id: actionId,
    value,
    ...(style && { style }),
  },
});

/**
 * Create a context block
 */
export const context = (elements: string[]): SlackBlock => ({
  type: 'context',
  elements: elements.map((text) => ({
    type: 'mrkdwn',
    text,
  })),
});

/**
 * Create an actions block with buttons
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
  elements: buttons.map((btn) => ({
    type: 'button',
    text: {
      type: 'plain_text',
      text: btn.text,
      emoji: true,
    },
    action_id: btn.actionId,
    value: btn.value,
    ...(btn.style && { style: btn.style }),
    ...(btn.url && { url: btn.url }),
  })),
});

/**
 * Build Meeting Debrief message
 */
export const buildMeetingDebriefMessage = (data: MeetingDebriefData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push(header(`🎯 Meeting Debrief: ${data.meetingTitle}`));

  // Metrics row
  const sentimentEmoji = getSentimentEmoji(data.sentiment);
  const talkTimeEmoji = getTalkTimeEmoji(data.talkTimeRep);

  blocks.push(section([
    `*Sentiment:* ${sentimentEmoji} ${data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1)} (${data.sentimentScore}%)`,
    `*Talk Time:* Rep ${data.talkTimeRep}% | Customer ${data.talkTimeCustomer}% ${talkTimeEmoji}`,
    `*Duration:* ${data.duration} minutes`,
  ].join('\n')));

  blocks.push(divider());

  // Summary
  blocks.push(section(`*📝 Summary*\n${data.summary}`));

  blocks.push(divider());

  // Action Items with Add Task buttons
  if (data.actionItems.length > 0) {
    blocks.push(section('*✅ Action Items*'));

    data.actionItems.forEach((item, index) => {
      const ownerText = item.suggestedOwner ? ` (${item.suggestedOwner})` : '';
      const taskValue = JSON.stringify({
        title: item.task,
        dealId: data.dealId,
        dueInDays: item.dueInDays || 3,
        meetingId: data.meetingId,
      });

      blocks.push(sectionWithButton(
        `• ${item.task}${ownerText}`,
        'Add Task',
        `add_task_${index}`,
        taskValue,
        'primary'
      ));
    });

    // Add All Tasks button
    if (data.actionItems.length > 1) {
      const allTasksValue = JSON.stringify({
        tasks: data.actionItems.map((item) => ({
          title: item.task,
          dealId: data.dealId,
          dueInDays: item.dueInDays || 3,
          meetingId: data.meetingId,
        })),
      });

      blocks.push(actions([
        { text: 'Add All Tasks', actionId: 'add_all_tasks', value: allTasksValue, style: 'primary' },
        { text: 'Dismiss', actionId: 'dismiss_tasks', value: data.meetingId },
      ]));
    }

    blocks.push(divider());
  }

  // Coaching Insight
  if (data.coachingInsight) {
    blocks.push(section(`*💡 Coaching Insight*\n${data.coachingInsight}`));
    blocks.push(divider());
  }

  // Action buttons
  const buttonRow: Array<{
    text: string;
    actionId: string;
    value: string;
    url?: string;
  }> = [
    { text: 'View Full Meeting', actionId: 'view_meeting', value: data.meetingId, url: `${data.appUrl}/meetings/${data.meetingId}` },
  ];

  if (data.dealId) {
    buttonRow.push({ text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` });
  }

  blocks.push(actions(buttonRow));

  return {
    blocks,
    text: `Meeting Debrief: ${data.meetingTitle} - ${data.summary.substring(0, 100)}...`,
  };
};

/**
 * Build Daily Standup Digest message
 */
export const buildDailyDigestMessage = (data: DailyDigestData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push(header(`☀️ Good Morning, ${data.teamName}! Here's your day.`));
  blocks.push(context([data.date]));

  blocks.push(divider());

  // Today's Meetings
  if (data.meetings.length > 0) {
    blocks.push(section(`*📅 TODAY'S MEETINGS (${data.meetings.length})*`));

    const meetingLines = data.meetings.slice(0, 5).map((m) => {
      const userMention = m.slackUserId ? `<@${m.slackUserId}>` : m.userName;
      let line = `*${m.time}* ${userMention} - ${m.title}`;
      if (m.prepNote) {
        const emoji = m.isImportant ? '⚠️' : '💡';
        line += `\n      ${emoji} _${m.prepNote}_`;
      }
      return line;
    });

    blocks.push(section(meetingLines.join('\n\n')));

    if (data.meetings.length > 5) {
      blocks.push(context([`+ ${data.meetings.length - 5} more meetings...`]));
    }

    blocks.push(divider());
  }

  // Tasks Needing Attention
  if (data.overdueTasks.length > 0 || data.dueTodayTasks.length > 0) {
    blocks.push(section('*🔥 TASKS NEEDING ATTENTION*'));

    if (data.overdueTasks.length > 0) {
      blocks.push(section(`*🔴 OVERDUE (${data.overdueTasks.length})*`));
      const overdueLines = data.overdueTasks.slice(0, 3).map((t) => {
        const userMention = t.slackUserId ? `<@${t.slackUserId}>` : t.userName;
        return `• ${userMention}: ${t.task} (${t.daysOverdue} day${t.daysOverdue > 1 ? 's' : ''})`;
      });
      blocks.push(section(overdueLines.join('\n')));
    }

    if (data.dueTodayTasks.length > 0) {
      blocks.push(section(`*🟡 DUE TODAY (${data.dueTodayTasks.length})*`));
      const dueTodayLines = data.dueTodayTasks.slice(0, 3).map((t) => {
        const userMention = t.slackUserId ? `<@${t.slackUserId}>` : t.userName;
        return `• ${userMention}: ${t.task}`;
      });
      blocks.push(section(dueTodayLines.join('\n')));
    }

    blocks.push(divider());
  }

  // AI Insights
  if (data.insights.length > 0) {
    blocks.push(section('*💡 AI INSIGHTS*'));
    const insightLines = data.insights.map((insight) => `• ${insight}`);
    blocks.push(section(insightLines.join('\n\n')));
    blocks.push(divider());
  }

  // Week Stats
  blocks.push(section([
    `*📊 TEAM STATS THIS WEEK*`,
    `Deals Closed: ${data.weekStats.dealsCount} (${formatCurrency(data.weekStats.dealsValue)}) | Meetings: ${data.weekStats.meetingsCount}`,
    `Activities: ${data.weekStats.activitiesCount} | Pipeline: ${formatCurrency(data.weekStats.pipelineValue)}`,
  ].join('\n')));

  // View Dashboard button
  blocks.push(actions([
    { text: 'View Dashboard', actionId: 'view_dashboard', value: 'dashboard', url: `${data.appUrl}/dashboard` },
  ]));

  return {
    blocks,
    text: `Daily Standup Digest for ${data.date}`,
  };
};

/**
 * Build Pre-Meeting Prep Card message
 */
export const buildMeetingPrepMessage = (data: MeetingPrepData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  // Header with user mention
  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.userName;
  blocks.push(header(`⏰ ${userMention} Meeting in 30 mins`));
  blocks.push(section(`*${data.meetingTitle}*`));

  blocks.push(divider());

  // Attendees
  if (data.attendees.length > 0) {
    blocks.push(section('*👥 ATTENDEES*'));

    const attendeeLines = data.attendees.map((a) => {
      let line = `*${a.name}*`;
      if (a.title) line += ` (${a.title})`;

      const badges: string[] = [];
      if (a.isDecisionMaker) badges.push('🎯 Decision Maker');
      if (a.isFirstMeeting) badges.push('🆕 First meeting!');
      if (a.meetingCount && a.meetingCount > 0) badges.push(`${a.meetingCount} prev meetings`);

      if (badges.length > 0) {
        line += `\n${badges.join(' | ')}`;
      }

      return line;
    });

    blocks.push(section(attendeeLines.join('\n\n')));
    blocks.push(divider());
  }

  // Company Info
  blocks.push(section([
    `*🏢 COMPANY: ${data.company.name}*`,
    [
      data.company.industry && `Industry: ${data.company.industry}`,
      data.company.size && `Size: ${data.company.size}`,
      data.company.stage && `Stage: ${data.company.stage}`,
    ].filter(Boolean).join(' | '),
  ].filter(Boolean).join('\n')));

  // Deal Info
  if (data.deal) {
    blocks.push(section([
      `*💰 DEAL: ${formatCurrency(data.deal.value)} | Stage: ${data.deal.stage}*`,
      [
        data.deal.winProbability !== undefined && `Win Probability: ${data.deal.winProbability}%`,
        data.deal.daysInPipeline !== undefined && `In pipeline: ${data.deal.daysInPipeline} days`,
      ].filter(Boolean).join(' | '),
    ].filter(Boolean).join('\n')));
  }

  blocks.push(divider());

  // Last Meeting Notes
  if (data.lastMeetingNotes) {
    blocks.push(section([
      `*💬 FROM LAST MEETING${data.lastMeetingDate ? ` (${data.lastMeetingDate})` : ''}*`,
      `_"${data.lastMeetingNotes}"_`,
    ].join('\n')));
    blocks.push(divider());
  }

  // Talking Points
  if (data.talkingPoints.length > 0) {
    blocks.push(section('*🎯 SUGGESTED TALKING POINTS*'));
    const talkingPointLines = data.talkingPoints.map((tp, i) => `${i + 1}. ${tp}`);
    blocks.push(section(talkingPointLines.join('\n')));
    blocks.push(divider());
  }

  // Action buttons
  const buttonRow: Array<{
    text: string;
    actionId: string;
    value: string;
    url?: string;
  }> = [];

  if (data.deal) {
    buttonRow.push({ text: 'Open Deal', actionId: 'view_deal', value: data.deal.id, url: `${data.appUrl}/deals/${data.deal.id}` });
  }

  buttonRow.push({ text: 'View Meeting', actionId: 'view_meeting', value: data.meetingId, url: `${data.appUrl}/meetings/${data.meetingId}` });

  if (data.meetingUrl) {
    buttonRow.push({ text: 'Join Call', actionId: 'join_meeting', value: data.meetingId, url: data.meetingUrl });
  }

  blocks.push(actions(buttonRow));

  return {
    blocks,
    text: `Meeting Prep: ${data.meetingTitle} in 30 minutes`,
  };
};

/**
 * Build Deal Room Initial Message
 */
export const buildDealRoomMessage = (data: DealRoomData): SlackMessage => {
  const blocks: SlackBlock[] = [];
  const companyName = data.companyName || data.company?.name || 'Unknown Company';

  // Header
  blocks.push(header(`💰 DEAL ROOM: ${companyName}`));

  // Deal Info
  const ownerMention = data.ownerSlackUserId ? `<@${data.ownerSlackUserId}>` : (data.ownerName || 'Unknown');
  blocks.push(section([
    `*Value:* ${formatCurrency(data.dealValue)} | *Stage:* ${data.dealStage}`,
    `*Owner:* ${ownerMention} | *Created:* ${new Date().toLocaleDateString()}`,
  ].join('\n')));

  blocks.push(divider());

  // Company Info
  const industry = data.companyIndustry || data.company?.industry;
  const size = data.companySize || data.company?.size;
  const location = data.company?.location;

  blocks.push(section([
    `*🏢 COMPANY*`,
    [
      industry && `Industry: ${industry}`,
      size && `Size: ${size}`,
      location && `HQ: ${location}`,
    ].filter(Boolean).join(' | '),
  ].filter(Boolean).join('\n')));

  blocks.push(divider());

  // Key Contacts
  const contacts = data.keyContacts || data.contacts || [];
  if (contacts.length > 0) {
    blocks.push(section('*👥 KEY CONTACTS*'));
    const contactLines = contacts.map((c) => {
      let line = `• *${c.name}*`;
      if (c.title) line += ` (${c.title})`;
      if (c.isDecisionMaker) line += ' - Decision Maker';
      return line;
    });
    blocks.push(section(contactLines.join('\n')));
    blocks.push(divider());
  }

  // AI Assessment
  const winProb = data.winProbability || data.aiAssessment?.winProbability;
  if (winProb || data.aiAssessment) {
    blocks.push(section([
      `*📊 AI ASSESSMENT*`,
      winProb && `Win Probability: ${winProb}%`,
      data.aiAssessment?.keyFactors && data.aiAssessment.keyFactors.length > 0 && `Key Factors: ${data.aiAssessment.keyFactors.join(', ')}`,
      data.aiAssessment?.risks && data.aiAssessment.risks.length > 0 && `Risks: ${data.aiAssessment.risks.join(', ')}`,
    ].filter(Boolean).join('\n')));
    blocks.push(divider());
  }

  // Action buttons
  blocks.push(actions([
    { text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    { text: 'View Company', actionId: 'view_company', value: companyName, url: `${data.appUrl}/companies?search=${encodeURIComponent(companyName)}` },
    { text: 'Log Activity', actionId: 'log_activity', value: data.dealId },
  ]));

  return {
    blocks,
    text: `Deal Room created for ${companyName} - ${formatCurrency(data.dealValue)}`,
  };
};

/**
 * Build Deal Room Welcome Message (used when channel is first created)
 */
export const buildDealRoomWelcomeMessage = (data: DealRoomData): SlackMessage => {
  return buildDealRoomMessage(data);
};

/**
 * Build Deal Stage Change message (for deal room updates)
 */
export const buildDealStageChangeMessage = (data: DealStageChangeData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.updatedBy;

  blocks.push(section(`🚀 *Stage Update*\nDeal moved: ${data.previousStage} → ${data.newStage}`));
  blocks.push(context([`_${userMention} updated just now_`]));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    ]));
  }

  return {
    blocks,
    text: `Stage Update: ${data.dealName} moved from ${data.previousStage} to ${data.newStage}`,
  };
};

/**
 * Build Deal Activity message (for deal room updates)
 */
export const buildDealActivityMessage = (data: DealActivityData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.createdBy;
  const activityEmoji = {
    'call': '📞',
    'email': '📧',
    'meeting': '📅',
    'proposal': '📝',
    'note': '📌',
    'task': '✅',
  }[data.activityType.toLowerCase()] || '📢';

  blocks.push(section(`${activityEmoji} *${data.activityType}* logged by ${userMention}\n\n${data.description}`));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    ]));
  }

  return {
    blocks,
    text: `Activity: ${data.activityType} - ${data.description}`,
  };
};

/**
 * Build Win Probability Change message (for deal room updates)
 */
export const buildWinProbabilityChangeMessage = (data: WinProbabilityChangeData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  const change = data.newProbability - data.previousProbability;
  const emoji = change > 0 ? '📈' : '⚠️';
  const direction = change > 0 ? '↑' : '↓';

  blocks.push(section(`${emoji} *Win Probability Changed*\n\n${data.previousProbability}% → ${data.newProbability}% (${direction}${Math.abs(change)}%)`));

  if (data.factors && data.factors.length > 0) {
    blocks.push(section(`*Factors:*\n${data.factors.map(f => `• ${f}`).join('\n')}`));
  }

  if (data.suggestedActions && data.suggestedActions.length > 0) {
    blocks.push(section(`*Suggested Actions:*\n${data.suggestedActions.map(a => `• ${a}`).join('\n')}`));
  }

  const buttonRow: Array<{
    text: string;
    actionId: string;
    value: string;
    url?: string;
  }> = [];

  if (data.dealId && data.appUrl) {
    buttonRow.push({ text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` });
  }
  buttonRow.push({ text: 'Create Task', actionId: 'create_task_from_alert', value: JSON.stringify({ dealId: data.dealId, type: 'win_probability' }) });

  blocks.push(actions(buttonRow));

  return {
    blocks,
    text: `Win Probability Alert: ${data.dealName} changed from ${data.previousProbability}% to ${data.newProbability}%`,
  };
};

/**
 * Build Deal Won message (for deal room updates)
 */
export const buildDealWonMessage = (data: DealWonData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.closedBy;

  blocks.push(section(`🎉 *DEAL WON!*\n\n*${data.companyName}* - ${formatCurrency(data.dealValue)}`));
  blocks.push(section(`Closed by ${userMention}${data.daysInPipeline ? `\nTime in pipeline: ${data.daysInPipeline} days` : ''}`));
  blocks.push(context(['🏆 This channel will be archived in 24 hours.']));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
      { text: 'Create Client Record', actionId: 'create_client', value: data.dealId },
    ]));
  }

  return {
    blocks,
    text: `Deal Won! ${data.companyName} - ${formatCurrency(data.dealValue)}`,
  };
};

/**
 * Build Deal Lost message (for deal room updates)
 */
export const buildDealLostMessage = (data: DealLostData): SlackMessage => {
  const blocks: SlackBlock[] = [];

  const userMention = data.slackUserId ? `<@${data.slackUserId}>` : data.closedBy;

  blocks.push(section(`😔 *Deal Lost*\n\n*${data.companyName}* - ${formatCurrency(data.dealValue)}`));

  if (data.lostReason) {
    blocks.push(section(`*Reason:* ${data.lostReason}`));
  }

  blocks.push(context([`Closed by ${userMention}. This channel will be archived.`]));

  if (data.dealId && data.appUrl) {
    blocks.push(actions([
      { text: 'View Deal', actionId: 'view_deal', value: data.dealId, url: `${data.appUrl}/deals/${data.dealId}` },
    ]));
  }

  return {
    blocks,
    text: `Deal Lost: ${data.companyName}`,
  };
};

/**
 * Build task completion confirmation (ephemeral)
 */
export const buildTaskAddedConfirmation = (taskTitle: string, count: number = 1): SlackMessage => {
  return {
    blocks: [
      section(count === 1
        ? `✅ Task "${taskTitle}" added to your task list!`
        : `✅ ${count} tasks added to your task list!`
      ),
    ],
    text: count === 1
      ? `Task "${taskTitle}" added to your task list!`
      : `${count} tasks added to your task list!`,
  };
};
