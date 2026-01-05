/**
 * Close Plan Service
 *
 * Manages the 6 standard milestones that track deal execution:
 * - success_criteria: Success criteria confirmed with customer
 * - stakeholders_mapped: All stakeholders identified and mapped
 * - solution_fit: Solution fit confirmed (usually SE involved)
 * - commercials_aligned: Pricing and terms aligned
 * - legal_procurement: Legal/procurement process progressing
 * - signature_kickoff: Contract signed and kickoff scheduled
 *
 * Provides lightweight execution tracking with optional task linking.
 */

import { supabase } from '@/lib/supabase/clientV2';

// =====================================================
// Types
// =====================================================

export type MilestoneKey =
  | 'success_criteria'
  | 'stakeholders_mapped'
  | 'solution_fit'
  | 'commercials_aligned'
  | 'legal_procurement'
  | 'signature_kickoff';

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped';

export interface ClosePlanItem {
  id: string;
  deal_id: string;
  org_id: string;
  milestone_key: MilestoneKey;
  title: string;
  owner_id: string | null;
  due_date: string | null; // ISO date string
  status: MilestoneStatus;
  blocker_note: string | null;
  linked_task_id: string | null;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClosePlanProgress {
  completed: number;
  total: number;
  overdue: number;
  progress_pct: number;
  blocked: number;
  in_progress: number;
}

export interface ClosePlanItemWithOwner extends ClosePlanItem {
  owner?: {
    id: string;
    display_name: string;
    email: string;
  } | null;
}

export interface MilestoneUpdateInput {
  status?: MilestoneStatus;
  owner_id?: string | null;
  due_date?: string | null;
  blocker_note?: string | null;
  notes?: string | null;
  completed_by?: string;
}

// =====================================================
// Milestone Metadata
// =====================================================

export const MILESTONE_METADATA: Record<MilestoneKey, {
  title: string;
  description: string;
  typicalOwner: string;
  sortOrder: number;
}> = {
  success_criteria: {
    title: 'Success criteria confirmed',
    description: 'Customer has agreed on how success will be measured',
    typicalOwner: 'AE',
    sortOrder: 1,
  },
  stakeholders_mapped: {
    title: 'Stakeholders mapped',
    description: 'All decision makers and influencers identified',
    typicalOwner: 'AE',
    sortOrder: 2,
  },
  solution_fit: {
    title: 'Solution fit confirmed',
    description: 'Technical validation complete, usually with SE involvement',
    typicalOwner: 'SE/AE',
    sortOrder: 3,
  },
  commercials_aligned: {
    title: 'Commercials aligned',
    description: 'Pricing, terms, and deal structure agreed',
    typicalOwner: 'AE',
    sortOrder: 4,
  },
  legal_procurement: {
    title: 'Legal/procurement progressing',
    description: 'Contract review and procurement process underway',
    typicalOwner: 'AE',
    sortOrder: 5,
  },
  signature_kickoff: {
    title: 'Signature + kickoff scheduled',
    description: 'Contract signed and implementation kickoff planned',
    typicalOwner: 'AE',
    sortOrder: 6,
  },
};

// =====================================================
// CRUD Operations
// =====================================================

/**
 * Get all close plan items for a deal
 */
export async function getClosePlanItems(dealId: string): Promise<ClosePlanItem[]> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select('*')
    .eq('deal_id', dealId)
    .order('sort_order');

  if (error) {
    console.error('Error fetching close plan items:', error);
    return [];
  }

  return data || [];
}

/**
 * Get close plan items with owner details
 */
export async function getClosePlanItemsWithOwners(
  dealId: string
): Promise<ClosePlanItemWithOwner[]> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select(`
      *,
      owner:profiles!owner_id (
        id,
        display_name,
        email
      )
    `)
    .eq('deal_id', dealId)
    .order('sort_order');

  if (error) {
    console.error('Error fetching close plan items with owners:', error);
    return [];
  }

  return (data || []) as ClosePlanItemWithOwner[];
}

/**
 * Get a specific milestone
 */
export async function getClosePlanItem(
  dealId: string,
  milestoneKey: MilestoneKey
): Promise<ClosePlanItem | null> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select('*')
    .eq('deal_id', dealId)
    .eq('milestone_key', milestoneKey)
    .maybeSingle();

  if (error) {
    console.error('Error fetching close plan item:', error);
    return null;
  }

  return data;
}

/**
 * Initialize close plan for a deal (creates all 6 milestones)
 */
export async function initializeClosePlan(
  dealId: string,
  orgId: string,
  ownerId?: string
): Promise<boolean> {
  const { error } = await supabase.rpc('initialize_deal_close_plan', {
    p_deal_id: dealId,
    p_org_id: orgId,
    p_owner_id: ownerId ?? null,
  });

  if (error) {
    console.error('Error initializing close plan:', error);
    return false;
  }

  return true;
}

/**
 * Check if close plan exists for a deal
 */
export async function hasClosePlan(dealId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('deal_close_plan_items')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId);

  if (error) {
    console.error('Error checking close plan:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * Update a milestone
 */
export async function updateClosePlanItem(
  dealId: string,
  milestoneKey: MilestoneKey,
  updates: MilestoneUpdateInput
): Promise<ClosePlanItem | null> {
  const updateData: Record<string, unknown> = {};

  if (updates.status !== undefined) {
    updateData.status = updates.status;

    // Auto-set completed_by when marking complete
    if (updates.status === 'completed' && updates.completed_by) {
      updateData.completed_by = updates.completed_by;
    }
  }

  if (updates.owner_id !== undefined) {
    updateData.owner_id = updates.owner_id;
  }

  if (updates.due_date !== undefined) {
    updateData.due_date = updates.due_date;
  }

  if (updates.blocker_note !== undefined) {
    updateData.blocker_note = updates.blocker_note;
  }

  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .update(updateData)
    .eq('deal_id', dealId)
    .eq('milestone_key', milestoneKey)
    .select()
    .single();

  if (error) {
    console.error('Error updating close plan item:', error);
    return null;
  }

  return data;
}

/**
 * Mark milestone as completed
 */
export async function completeMilestone(
  dealId: string,
  milestoneKey: MilestoneKey,
  completedBy: string,
  notes?: string
): Promise<ClosePlanItem | null> {
  return updateClosePlanItem(dealId, milestoneKey, {
    status: 'completed',
    completed_by: completedBy,
    notes,
  });
}

/**
 * Mark milestone as blocked
 */
export async function blockMilestone(
  dealId: string,
  milestoneKey: MilestoneKey,
  blockerNote: string
): Promise<ClosePlanItem | null> {
  return updateClosePlanItem(dealId, milestoneKey, {
    status: 'blocked',
    blocker_note: blockerNote,
  });
}

/**
 * Skip a milestone (not applicable for this deal)
 */
export async function skipMilestone(
  dealId: string,
  milestoneKey: MilestoneKey,
  notes?: string
): Promise<ClosePlanItem | null> {
  return updateClosePlanItem(dealId, milestoneKey, {
    status: 'skipped',
    notes,
  });
}

/**
 * Reset milestone to pending
 */
export async function resetMilestone(
  dealId: string,
  milestoneKey: MilestoneKey
): Promise<ClosePlanItem | null> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .update({
      status: 'pending',
      blocker_note: null,
      completed_at: null,
      completed_by: null,
    })
    .eq('deal_id', dealId)
    .eq('milestone_key', milestoneKey)
    .select()
    .single();

  if (error) {
    console.error('Error resetting milestone:', error);
    return null;
  }

  return data;
}

// =====================================================
// Task Linking
// =====================================================

/**
 * Link a task to a milestone
 */
export async function linkTaskToMilestone(
  dealId: string,
  milestoneKey: MilestoneKey,
  taskId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('deal_close_plan_items')
    .update({ linked_task_id: taskId })
    .eq('deal_id', dealId)
    .eq('milestone_key', milestoneKey);

  if (error) {
    console.error('Error linking task to milestone:', error);
    return false;
  }

  return true;
}

/**
 * Unlink task from milestone
 */
export async function unlinkTaskFromMilestone(
  dealId: string,
  milestoneKey: MilestoneKey
): Promise<boolean> {
  const { error } = await supabase
    .from('deal_close_plan_items')
    .update({ linked_task_id: null })
    .eq('deal_id', dealId)
    .eq('milestone_key', milestoneKey);

  if (error) {
    console.error('Error unlinking task from milestone:', error);
    return false;
  }

  return true;
}

// =====================================================
// Progress Calculations
// =====================================================

/**
 * Get close plan progress using the database function
 */
export async function getClosePlanProgress(dealId: string): Promise<ClosePlanProgress | null> {
  const { data, error } = await supabase.rpc('calculate_close_plan_progress', {
    p_deal_id: dealId,
  });

  if (error) {
    console.error('Error calculating close plan progress:', error);
    return null;
  }

  // Also get blocked and in_progress counts
  const items = await getClosePlanItems(dealId);
  const blocked = items.filter(i => i.status === 'blocked').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;

  return {
    completed: data?.[0]?.completed ?? 0,
    total: data?.[0]?.total ?? 6,
    overdue: data?.[0]?.overdue ?? 0,
    progress_pct: data?.[0]?.progress_pct ?? 0,
    blocked,
    in_progress: inProgress,
  };
}

/**
 * Calculate progress client-side
 */
export function calculateClientSideProgress(items: ClosePlanItem[]): ClosePlanProgress {
  const activeItems = items.filter(i => i.status !== 'skipped');
  const completed = activeItems.filter(i => i.status === 'completed').length;
  const blocked = activeItems.filter(i => i.status === 'blocked').length;
  const inProgress = activeItems.filter(i => i.status === 'in_progress').length;

  const today = new Date().toISOString().split('T')[0];
  const overdue = activeItems.filter(i =>
    i.status !== 'completed' &&
    i.due_date &&
    i.due_date < today
  ).length;

  const total = activeItems.length;

  return {
    completed,
    total,
    overdue,
    progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    blocked,
    in_progress: inProgress,
  };
}

// =====================================================
// Status Queries
// =====================================================

/**
 * Get overdue milestones
 */
export async function getOverdueMilestones(dealId: string): Promise<ClosePlanItem[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select('*')
    .eq('deal_id', dealId)
    .not('status', 'in', '("completed","skipped")')
    .lt('due_date', today)
    .order('due_date');

  if (error) {
    console.error('Error fetching overdue milestones:', error);
    return [];
  }

  return data || [];
}

/**
 * Get blocked milestones
 */
export async function getBlockedMilestones(dealId: string): Promise<ClosePlanItem[]> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select('*')
    .eq('deal_id', dealId)
    .eq('status', 'blocked')
    .order('sort_order');

  if (error) {
    console.error('Error fetching blocked milestones:', error);
    return [];
  }

  return data || [];
}

/**
 * Get the next pending milestone (the one to focus on)
 */
export async function getNextMilestone(dealId: string): Promise<ClosePlanItem | null> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select('*')
    .eq('deal_id', dealId)
    .in('status', ['pending', 'in_progress', 'blocked'])
    .order('sort_order')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching next milestone:', error);
    return null;
  }

  return data;
}

/**
 * Get milestones that need tasks created
 * (in_progress or blocked without linked task)
 */
export async function getMilestonesNeedingTasks(dealId: string): Promise<ClosePlanItem[]> {
  const { data, error } = await supabase
    .from('deal_close_plan_items')
    .select('*')
    .eq('deal_id', dealId)
    .in('status', ['in_progress', 'blocked'])
    .is('linked_task_id', null)
    .order('sort_order');

  if (error) {
    console.error('Error fetching milestones needing tasks:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// Org-Wide Queries
// =====================================================

/**
 * Get all deals with overdue milestones in an org
 */
export async function getDealsWithOverdueMilestones(
  orgId: string,
  options?: { userId?: string; limit?: number }
): Promise<{
  deal_id: string;
  deal_name: string;
  company_name: string | null;
  overdue_count: number;
  milestones: ClosePlanItem[];
}[]> {
  const today = new Date().toISOString().split('T')[0];

  // First get overdue items
  let query = supabase
    .from('deal_close_plan_items')
    .select(`
      *,
      deal:deals!deal_id (
        id,
        name,
        user_id,
        company:companies!company_id (name)
      )
    `)
    .eq('org_id', orgId)
    .not('status', 'in', '("completed","skipped")')
    .lt('due_date', today)
    .order('due_date');

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching overdue milestones:', error);
    return [];
  }

  // Group by deal
  const dealMap = new Map<string, {
    deal_id: string;
    deal_name: string;
    company_name: string | null;
    user_id: string;
    milestones: ClosePlanItem[];
  }>();

  for (const item of data || []) {
    const deal = item.deal as { id: string; name: string; user_id: string; company: { name: string } | null };

    if (!dealMap.has(deal.id)) {
      dealMap.set(deal.id, {
        deal_id: deal.id,
        deal_name: deal.name,
        company_name: deal.company?.name ?? null,
        user_id: deal.user_id,
        milestones: [],
      });
    }

    // Remove the deal property from the item before pushing
    const { deal: _, ...milestone } = item;
    dealMap.get(deal.id)!.milestones.push(milestone as ClosePlanItem);
  }

  // Filter by user if specified and apply limit
  let results = Array.from(dealMap.values());

  if (options?.userId) {
    results = results.filter(d => d.user_id === options.userId);
  }

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results.map(d => ({
    deal_id: d.deal_id,
    deal_name: d.deal_name,
    company_name: d.company_name,
    overdue_count: d.milestones.length,
    milestones: d.milestones,
  }));
}

/**
 * Get all blocked milestones in an org
 */
export async function getOrgBlockedMilestones(
  orgId: string,
  options?: { userId?: string; limit?: number }
): Promise<{
  deal_id: string;
  deal_name: string;
  company_name: string | null;
  milestone: ClosePlanItem;
}[]> {
  let query = supabase
    .from('deal_close_plan_items')
    .select(`
      *,
      deal:deals!deal_id (
        id,
        name,
        user_id,
        company:companies!company_id (name)
      )
    `)
    .eq('org_id', orgId)
    .eq('status', 'blocked')
    .order('updated_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching blocked milestones:', error);
    return [];
  }

  const results = (data || [])
    .map(item => {
      const deal = item.deal as { id: string; name: string; user_id: string; company: { name: string } | null };
      const { deal: _, ...milestone } = item;

      return {
        deal_id: deal.id,
        deal_name: deal.name,
        company_name: deal.company?.name ?? null,
        user_id: deal.user_id,
        milestone: milestone as ClosePlanItem,
      };
    });

  if (options?.userId) {
    return results.filter(r => r.user_id === options.userId);
  }

  return results;
}

// =====================================================
// Slack/UI Helpers
// =====================================================

/**
 * Get close plan summary for Slack card
 */
export async function getClosePlanSummary(dealId: string): Promise<{
  progress: ClosePlanProgress;
  nextMilestone: ClosePlanItem | null;
  blockedMilestones: ClosePlanItem[];
  overdueMilestones: ClosePlanItem[];
} | null> {
  const [items, progress] = await Promise.all([
    getClosePlanItems(dealId),
    getClosePlanProgress(dealId),
  ]);

  if (!progress) return null;

  const today = new Date().toISOString().split('T')[0];

  const blockedMilestones = items.filter(i => i.status === 'blocked');
  const overdueMilestones = items.filter(i =>
    i.status !== 'completed' &&
    i.status !== 'skipped' &&
    i.due_date &&
    i.due_date < today
  );

  const pendingOrInProgress = items.filter(i =>
    i.status === 'pending' || i.status === 'in_progress' || i.status === 'blocked'
  );
  const nextMilestone = pendingOrInProgress.length > 0 ? pendingOrInProgress[0] : null;

  return {
    progress,
    nextMilestone,
    blockedMilestones,
    overdueMilestones,
  };
}

/**
 * Format milestone status for display
 */
export function formatMilestoneStatus(status: MilestoneStatus): {
  label: string;
  emoji: string;
  color: string;
} {
  switch (status) {
    case 'completed':
      return { label: 'Completed', emoji: '✅', color: 'green' };
    case 'in_progress':
      return { label: 'In Progress', emoji: '🔄', color: 'blue' };
    case 'blocked':
      return { label: 'Blocked', emoji: '🚫', color: 'red' };
    case 'skipped':
      return { label: 'Skipped', emoji: '⏭️', color: 'gray' };
    case 'pending':
    default:
      return { label: 'Pending', emoji: '⏳', color: 'gray' };
  }
}

/**
 * Get progress bar representation
 */
export function getProgressBar(progress: ClosePlanProgress, width: number = 10): string {
  const filled = Math.round((progress.completed / progress.total) * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format due date with warning if overdue
 */
export function formatDueDate(dueDate: string | null): {
  text: string;
  isOverdue: boolean;
  daysUntil: number | null;
} {
  if (!dueDate) {
    return { text: 'No due date', isOverdue: false, daysUntil: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`,
      isOverdue: true,
      daysUntil: diffDays
    };
  } else if (diffDays === 0) {
    return { text: 'Due today', isOverdue: false, daysUntil: 0 };
  } else if (diffDays === 1) {
    return { text: 'Due tomorrow', isOverdue: false, daysUntil: 1 };
  } else if (diffDays <= 7) {
    return { text: `Due in ${diffDays} days`, isOverdue: false, daysUntil: diffDays };
  } else {
    return {
      text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: false,
      daysUntil: diffDays
    };
  }
}
