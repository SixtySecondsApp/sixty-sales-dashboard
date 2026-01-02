// supabase/functions/slack-slash-commands/handlers/task.ts
// Handlers for /sixty task add, /sixty task list, /sixty focus

import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  deal_id: string | null;
  contact_id: string | null;
  created_at: string;
  deals?: { id: string; name: string } | null;
  contacts?: { id: string; name: string } | null;
}

interface SlackMessage {
  blocks: unknown[];
  text: string;
}

// ============================================================================
// Task Add Command
// ============================================================================

/**
 * Handle /sixty task add <text>
 * Parses natural language for due dates and deal references
 */
export async function handleTaskAdd(ctx: CommandContext, text: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  if (!text.trim()) {
    return buildErrorResponse(
      'Please provide a task description.\n\nExamples:\n• `/sixty task add Follow up with John tomorrow`\n• `/sixty task add Send proposal next week re: Acme deal`'
    );
  }

  try {
    // Parse the task text for due date hints and deal references
    const parsed = parseTaskText(text);

    // Look up deal if referenced
    let dealId: string | null = null;
    let dealName: string | null = null;

    if (parsed.dealReference) {
      const { data: deal } = await supabase
        .from('deals')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', `%${parsed.dealReference}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deal) {
        dealId = deal.id;
        dealName = deal.name;
      }
    }

    // Create the task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: parsed.title,
        description: null,
        assigned_to: userId,
        created_by: userId,
        ...(orgId ? { org_id: orgId } : {}),
        deal_id: dealId,
        due_date: parsed.dueDate?.toISOString() || null,
        status: 'pending',
        source: 'slack_command',
        metadata: {
          source: 'slack_task_add',
          original_text: text,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create task:', error);
      return buildErrorResponse('Failed to create task. Please try again.');
    }

    // Format due date for display
    const dueDateStr = parsed.dueDate
      ? parsed.dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'No due date';

    const blocks: unknown[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Task created*\n${parsed.title}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Sixty', emoji: true },
          url: `${appUrl}/tasks/${task.id}`,
          action_id: 'view_task',
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `${dueDateStr}${dealName ? ` • Linked to *${dealName}*` : ''}` },
        ],
      },
    ];

    // Add quick action buttons
    const actionValue = JSON.stringify({ taskId: task.id });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Complete', emoji: true },
          action_id: 'task_complete',
          value: actionValue,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Snooze 1 day', emoji: true },
          action_id: 'task_snooze_1d',
          value: actionValue,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit', emoji: true },
          action_id: 'task_edit',
          value: actionValue,
        },
      ],
    });

    return {
      blocks,
      text: `Task created: ${parsed.title}`,
    };
  } catch (error) {
    console.error('Error in handleTaskAdd:', error);
    return buildErrorResponse('Failed to create task. Please try again.');
  }
}

/**
 * Parse task text for due date hints and deal references
 */
function parseTaskText(text: string): {
  title: string;
  dueDate: Date | null;
  dealReference: string | null;
} {
  let title = text;
  let dueDate: Date | null = null;
  let dealReference: string | null = null;

  const now = new Date();

  // Extract deal reference (re: <deal>, for <deal>)
  const dealMatch = text.match(/(?:re:|for:|about:)\s*([^,]+?)(?:\s+(?:tomorrow|today|next|in\s+\d|by\s+)|\s*$)/i);
  if (dealMatch) {
    dealReference = dealMatch[1].trim();
    title = title.replace(dealMatch[0], '').trim();
  }

  // Parse due date hints
  const lowerText = text.toLowerCase();

  if (lowerText.includes('today')) {
    dueDate = new Date(now);
    dueDate.setHours(17, 0, 0, 0); // End of business day
    title = title.replace(/\btoday\b/gi, '').trim();
  } else if (lowerText.includes('tomorrow')) {
    dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 1);
    dueDate.setHours(17, 0, 0, 0);
    title = title.replace(/\btomorrow\b/gi, '').trim();
  } else if (lowerText.includes('next week')) {
    dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);
    dueDate.setHours(17, 0, 0, 0);
    title = title.replace(/\bnext week\b/gi, '').trim();
  } else if (lowerText.includes('this week')) {
    // Friday of current week
    dueDate = new Date(now);
    const dayOfWeek = dueDate.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
    dueDate.setDate(dueDate.getDate() + daysUntilFriday);
    dueDate.setHours(17, 0, 0, 0);
    title = title.replace(/\bthis week\b/gi, '').trim();
  } else if (lowerText.includes('end of day') || lowerText.includes('eod')) {
    dueDate = new Date(now);
    dueDate.setHours(17, 0, 0, 0);
    title = title.replace(/\b(?:end of day|eod)\b/gi, '').trim();
  } else {
    // Check for "in X days" pattern
    const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/i);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + days);
      dueDate.setHours(17, 0, 0, 0);
      title = title.replace(inDaysMatch[0], '').trim();
    }
  }

  // Clean up title (remove extra spaces, trailing punctuation)
  title = title.replace(/\s+/g, ' ').replace(/[,;]+$/, '').trim();

  // If title is empty after parsing, use original text
  if (!title) {
    title = text;
  }

  return { title, dueDate, dealReference };
}

// ============================================================================
// Task List Command
// ============================================================================

/**
 * Handle /sixty task list [filter]
 * Shows today's tasks and overdue tasks
 */
export async function handleTaskList(ctx: CommandContext, filter: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;

  const filterLower = filter.toLowerCase().trim();

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let query = supabase
      .from('tasks')
      .select('id, title, description, status, due_date, deal_id, contact_id, created_at, deals ( id, name ), contacts ( id, name )')
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false });

    // Apply filter
    if (filterLower === 'overdue') {
      query = query.lt('due_date', todayStart.toISOString());
    } else if (filterLower === 'today') {
      query = query
        .gte('due_date', todayStart.toISOString())
        .lte('due_date', todayEnd.toISOString());
    } else if (filterLower === 'week' || filterLower === 'this week') {
      query = query
        .gte('due_date', todayStart.toISOString())
        .lte('due_date', weekEnd.toISOString());
    } else {
      // Default: show overdue + today + this week
      query = query.or(`due_date.lt.${todayStart.toISOString()},due_date.lte.${weekEnd.toISOString()}`);
    }

    const { data: tasks } = await query.limit(15);

    if (!tasks || tasks.length === 0) {
      const noTasksMessage = filterLower === 'overdue'
        ? 'No overdue tasks - you\'re all caught up!'
        : filterLower === 'today'
        ? 'No tasks due today.'
        : 'No upcoming tasks found.';

      return {
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: noTasksMessage },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '+ Add Task', emoji: true },
                action_id: 'open_add_task_modal',
                style: 'primary',
              },
            ],
          },
        ],
        text: noTasksMessage,
      };
    }

    // Categorize tasks
    const overdueTasks = tasks.filter((t: Task) => t.due_date && new Date(t.due_date) < todayStart);
    const todayTasks = tasks.filter((t: Task) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= todayStart && d <= todayEnd;
    });
    const upcomingTasks = tasks.filter((t: Task) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d > todayEnd;
    });
    const noDueDateTasks = tasks.filter((t: Task) => !t.due_date);

    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Your Tasks', emoji: true },
      },
    ];

    // Add overdue section
    if (overdueTasks.length > 0) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Overdue* (${overdueTasks.length})` },
        }
      );
      overdueTasks.forEach((task: Task) => {
        blocks.push(buildTaskBlock(task, appUrl));
      });
    }

    // Add today section
    if (todayTasks.length > 0) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Today* (${todayTasks.length})` },
        }
      );
      todayTasks.forEach((task: Task) => {
        blocks.push(buildTaskBlock(task, appUrl));
      });
    }

    // Add upcoming section
    if (upcomingTasks.length > 0) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*This Week* (${upcomingTasks.length})` },
        }
      );
      upcomingTasks.forEach((task: Task) => {
        blocks.push(buildTaskBlock(task, appUrl));
      });
    }

    // Add no due date section
    if (noDueDateTasks.length > 0 && filterLower !== 'overdue' && filterLower !== 'today') {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*No Due Date* (${noDueDateTasks.length})` },
        }
      );
      noDueDateTasks.slice(0, 3).forEach((task: Task) => {
        blocks.push(buildTaskBlock(task, appUrl));
      });
    }

    // Add filter buttons
    blocks.push(
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Overdue', emoji: true },
            action_id: 'task_filter_overdue',
            ...(filterLower === 'overdue' ? { style: 'primary' } : {}),
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Today', emoji: true },
            action_id: 'task_filter_today',
            ...(filterLower === 'today' ? { style: 'primary' } : {}),
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'This Week', emoji: true },
            action_id: 'task_filter_week',
            ...(filterLower === 'week' || filterLower === 'this week' ? { style: 'primary' } : {}),
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '+ Add Task', emoji: true },
            action_id: 'open_add_task_modal',
          },
        ],
      }
    );

    // Add view all link
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `<${appUrl}/tasks|View all tasks in Sixty>` },
      ],
    });

    return {
      blocks,
      text: `You have ${tasks.length} tasks`,
    };
  } catch (error) {
    console.error('Error in handleTaskList:', error);
    return buildErrorResponse('Failed to load tasks. Please try again.');
  }
}

/**
 * Build a task block with action buttons
 */
function buildTaskBlock(task: Task, appUrl: string): unknown {
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const now = new Date();
  const isOverdue = dueDate && dueDate < now;

  let dueDateStr = 'No due date';
  if (dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskDate = new Date(dueDate);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) {
      dueDateStr = 'Today';
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      dueDateStr = 'Tomorrow';
    } else {
      dueDateStr = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  const dealInfo = (task as any).deals?.name ? ` • ${(task as any).deals.name}` : '';
  const overdueEmoji = isOverdue ? ' :warning:' : '';

  const actionValue = JSON.stringify({ taskId: task.id });

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${task.status === 'in_progress' ? ':large_blue_circle:' : ':white_circle:'} *${task.title}*\n${dueDateStr}${overdueEmoji}${dealInfo}`,
    },
    accessory: {
      type: 'overflow',
      action_id: 'task_overflow',
      options: [
        { text: { type: 'plain_text', text: 'Complete' }, value: `complete:${task.id}` },
        { text: { type: 'plain_text', text: 'Snooze 1 day' }, value: `snooze_1d:${task.id}` },
        { text: { type: 'plain_text', text: 'Snooze 1 week' }, value: `snooze_1w:${task.id}` },
        { text: { type: 'plain_text', text: 'Log activity' }, value: `log_activity:${task.id}` },
        { text: { type: 'plain_text', text: 'Convert to follow-up' }, value: `convert_followup:${task.id}` },
        { text: { type: 'plain_text', text: 'View in Sixty' }, value: `view:${task.id}` },
      ],
    },
  };
}

// ============================================================================
// Focus Command
// ============================================================================

/**
 * Handle /sixty focus
 * Shows top priority tasks for focused work
 */
export async function handleFocus(ctx: CommandContext): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;

  try {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's high priority tasks (overdue + due today)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, description, status, due_date, deal_id, deals ( id, name )')
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .lte('due_date', todayEnd.toISOString())
      .order('due_date', { ascending: true })
      .limit(5);

    // Get today's meetings for context
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, start_time')
      .eq('owner_user_id', userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(3);

    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Focus Mode', emoji: true },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Your top priorities for ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}` },
        ],
      },
      { type: 'divider' },
    ];

    // Add upcoming meeting if any
    if (meetings && meetings.length > 0) {
      const nextMeeting = meetings[0];
      const meetingTime = new Date(nextMeeting.start_time);
      const timeStr = meetingTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:calendar: *Next up at ${timeStr}*\n${nextMeeting.title}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Prep', emoji: true },
          action_id: 'focus_meeting_prep',
          value: nextMeeting.id,
        },
      });
      blocks.push({ type: 'divider' });
    }

    // Add tasks
    if (!tasks || tasks.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':tada: *No urgent tasks!*\nYou\'re all caught up for today.',
        },
      });
    } else {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:dart: *Top ${tasks.length} Tasks*` },
      });

      tasks.forEach((task: any, index: number) => {
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate && dueDate < now;
        const dealInfo = task.deals?.name ? ` (${task.deals.name})` : '';
        const overdueTag = isOverdue ? ' :warning: *overdue*' : '';

        const actionValue = JSON.stringify({ taskId: task.id, index });

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${index + 1}. ${task.title}${dealInfo}${overdueTag}`,
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Done', emoji: true },
            action_id: 'focus_task_done',
            value: actionValue,
            style: 'primary',
          },
        });
      });
    }

    // Add focus actions
    blocks.push(
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: ':arrows_counterclockwise: Refresh', emoji: true },
            action_id: 'focus_refresh',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: ':clipboard: All Tasks', emoji: true },
            action_id: 'focus_view_all',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: ':heavy_plus_sign: Quick Add', emoji: true },
            action_id: 'open_add_task_modal',
          },
        ],
      }
    );

    return {
      blocks,
      text: `Focus mode: ${tasks?.length || 0} priority tasks`,
    };
  } catch (error) {
    console.error('Error in handleFocus:', error);
    return buildErrorResponse('Failed to load focus view. Please try again.');
  }
}
