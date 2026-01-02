// supabase/functions/slack-slash-commands/handlers/approvals.ts
// Handler for /sixty approvals - Pending HITL approvals

import { type SlackMessage } from '../../_shared/slackBlocks.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

interface PendingApproval {
  id: string;
  type: 'follow_up' | 'task' | 'activity' | 'email';
  title: string;
  description: string;
  created_at: string;
  related_entity: {
    type: 'contact' | 'deal' | 'meeting';
    id: string;
    name: string;
  } | null;
  draft_content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Handle /sixty approvals command
 * Shows pending HITL (Human-in-the-Loop) approvals
 */
export async function handleApprovals(ctx: CommandContext): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  if (!orgId) {
    return buildErrorResponse('Unable to determine your organization. Please contact support.');
  }

  try {
    // Get pending approvals from various sources
    const approvals = await getPendingApprovals(ctx, userId, orgId);

    if (approvals.length === 0) {
      return {
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: ':white_check_mark: All Caught Up!', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'No pending approvals right now.\n\nAI-drafted messages will appear here for your review before being sent.',
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `_Checked ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}_` },
            ],
          },
        ],
        text: 'No pending approvals',
      };
    }

    // Build the approvals message
    return buildApprovalsMessage(approvals, appUrl);

  } catch (error) {
    console.error('Error in handleApprovals:', error);
    return buildErrorResponse('Failed to load pending approvals. Please try again.');
  }
}

/**
 * Get pending approvals from various sources
 */
async function getPendingApprovals(
  ctx: CommandContext,
  userId: string,
  orgId: string
): Promise<PendingApproval[]> {
  const { supabase } = ctx;
  const approvals: PendingApproval[] = [];

  // 1. Get pending AI suggestions (workflow suggestions)
  const { data: suggestions } = await supabase
    .from('ai_suggestions')
    .select(`
      id,
      suggestion_type,
      title,
      description,
      content,
      metadata,
      created_at,
      contact_id,
      deal_id,
      contacts ( id, name ),
      deals ( id, name )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (suggestions) {
    suggestions.forEach((s: any) => {
      approvals.push({
        id: s.id,
        type: mapSuggestionType(s.suggestion_type),
        title: s.title || 'AI Suggestion',
        description: s.description || '',
        created_at: s.created_at,
        related_entity: s.deal_id
          ? { type: 'deal', id: s.deal_id, name: s.deals?.name || 'Deal' }
          : s.contact_id
            ? { type: 'contact', id: s.contact_id, name: s.contacts?.name || 'Contact' }
            : null,
        draft_content: s.content,
        metadata: s.metadata,
      });
    });
  }

  // 2. Get pending draft messages (if we have a drafts table)
  const { data: drafts } = await supabase
    .from('draft_messages')
    .select(`
      id,
      message_type,
      subject,
      body,
      created_at,
      contact_id,
      deal_id,
      contacts ( id, name ),
      deals ( id, name )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })
    .limit(10);

  if (drafts) {
    drafts.forEach((d: any) => {
      approvals.push({
        id: d.id,
        type: d.message_type === 'email' ? 'email' : 'follow_up',
        title: d.subject || 'Draft Message',
        description: truncateText(d.body || '', 100),
        created_at: d.created_at,
        related_entity: d.deal_id
          ? { type: 'deal', id: d.deal_id, name: d.deals?.name || 'Deal' }
          : d.contact_id
            ? { type: 'contact', id: d.contact_id, name: d.contacts?.name || 'Contact' }
            : null,
        draft_content: d.body,
      });
    });
  }

  // 3. Get pending next action suggestions
  const { data: nextActions } = await supabase
    .from('next_action_suggestions')
    .select(`
      id,
      action_type,
      title,
      description,
      created_at,
      deal_id,
      deals ( id, name )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (nextActions) {
    nextActions.forEach((n: any) => {
      approvals.push({
        id: n.id,
        type: 'task',
        title: n.title || 'Suggested Action',
        description: n.description || '',
        created_at: n.created_at,
        related_entity: n.deal_id
          ? { type: 'deal', id: n.deal_id, name: n.deals?.name || 'Deal' }
          : null,
      });
    });
  }

  // Sort by created_at (newest first)
  approvals.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return approvals.slice(0, 15);
}

/**
 * Map suggestion type to approval type
 */
function mapSuggestionType(type: string): PendingApproval['type'] {
  switch (type) {
    case 'follow_up':
    case 'followup':
    case 'email_draft':
      return 'follow_up';
    case 'task':
    case 'action_item':
      return 'task';
    case 'activity':
    case 'log_activity':
      return 'activity';
    case 'email':
    case 'send_email':
      return 'email';
    default:
      return 'follow_up';
  }
}

/**
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get time ago string
 */
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get type emoji
 */
function getTypeEmoji(type: PendingApproval['type']): string {
  switch (type) {
    case 'follow_up':
      return ':envelope:';
    case 'task':
      return ':ballot_box_with_check:';
    case 'activity':
      return ':pencil:';
    case 'email':
      return ':email:';
    default:
      return ':robot_face:';
  }
}

/**
 * Get type label
 */
function getTypeLabel(type: PendingApproval['type']): string {
  switch (type) {
    case 'follow_up':
      return 'Follow-up Draft';
    case 'task':
      return 'Suggested Task';
    case 'activity':
      return 'Activity Log';
    case 'email':
      return 'Email Draft';
    default:
      return 'Suggestion';
  }
}

/**
 * Build the approvals Slack message
 */
function buildApprovalsMessage(
  approvals: PendingApproval[],
  appUrl: string
): SlackMessage {
  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:inbox_tray: ${approvals.length} Pending Approval${approvals.length !== 1 ? 's' : ''}`,
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: 'AI-generated content waiting for your review' },
      ],
    },
    { type: 'divider' },
  ];

  // Group by type for summary
  const typeCounts = approvals.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeLabels = Object.entries(typeCounts)
    .map(([type, count]) => `${getTypeEmoji(type as PendingApproval['type'])} ${count} ${getTypeLabel(type as PendingApproval['type'])}${count !== 1 ? 's' : ''}`)
    .join(' • ');

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: typeLabels }],
  });

  blocks.push({ type: 'divider' });

  // Show each approval (max 8)
  approvals.slice(0, 8).forEach(approval => {
    const emoji = getTypeEmoji(approval.type);
    const typeLabel = getTypeLabel(approval.type);
    const timeAgo = getTimeAgo(approval.created_at);
    const entityText = approval.related_entity
      ? `_${approval.related_entity.type}: ${approval.related_entity.name}_\n`
      : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${approval.title}*\n` +
              entityText +
              `${approval.description}\n` +
              `_${timeAgo}_`,
      },
      accessory: {
        type: 'overflow',
        action_id: 'approval_actions',
        options: [
          {
            text: { type: 'plain_text', text: ':white_check_mark: Approve', emoji: true },
            value: `approve:${approval.type}:${approval.id}`,
          },
          {
            text: { type: 'plain_text', text: ':pencil2: Edit & Approve', emoji: true },
            value: `edit:${approval.type}:${approval.id}`,
          },
          {
            text: { type: 'plain_text', text: ':x: Reject', emoji: true },
            value: `reject:${approval.type}:${approval.id}`,
          },
          {
            text: { type: 'plain_text', text: ':eyes: View Details', emoji: true },
            value: `view:${approval.type}:${approval.id}`,
          },
        ],
      },
    });
  });

  if (approvals.length > 8) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_Showing 8 of ${approvals.length} pending approvals_` },
      ],
    });
  }

  blocks.push({ type: 'divider' });

  // Bulk actions
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: ':white_check_mark: Approve All', emoji: true },
        action_id: 'approvals_approve_all',
        style: 'primary',
        confirm: {
          title: { type: 'plain_text', text: 'Approve All?' },
          text: { type: 'mrkdwn', text: `Are you sure you want to approve all ${approvals.length} pending items?` },
          confirm: { type: 'plain_text', text: 'Approve All' },
          deny: { type: 'plain_text', text: 'Cancel' },
        },
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':arrows_counterclockwise: Refresh', emoji: true },
        action_id: 'approvals_refresh',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':gear: Settings', emoji: true },
        action_id: 'approvals_settings',
        url: `${appUrl}/settings/ai`,
      },
    ],
  });

  return {
    blocks,
    text: `${approvals.length} pending approval${approvals.length !== 1 ? 's' : ''} waiting for review`,
  };
}
