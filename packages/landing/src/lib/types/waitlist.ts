/**
 * Types for meetings waitlist system
 * Public signup with referral tracking and admin management
 */

export type WaitlistStatus = 'pending' | 'released' | 'declined' | 'converted';

export interface WaitlistEntry {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  dialer_tool?: string;
  dialer_other?: string;
  meeting_recorder_tool?: string;
  meeting_recorder_other?: string;
  crm_tool?: string;
  crm_other?: string;
  task_manager_tool?: string;
  task_manager_other?: string;
  referral_code: string;
  referred_by_code?: string;
  referral_count: number;
  signup_position?: number;
  effective_position?: number;
  total_points?: number;
  linkedin_boost_claimed?: boolean;
  twitter_boost_claimed?: boolean;
  email_boost_claimed?: boolean;
  email_first_share_at?: string;
  status: WaitlistStatus;
  released_at?: string;
  released_by?: string;
  admin_notes?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  registration_url?: string; // Full URL (path + query params) where user registered from
  linkedin_share_claimed?: boolean;
  linkedin_first_share_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WaitlistSignupData {
  email: string;
  full_name: string;
  company_name: string;
  dialer_tool?: string;
  dialer_other?: string;
  meeting_recorder_tool?: string;
  meeting_recorder_other?: string;
  crm_tool?: string;
  crm_other?: string;
  task_manager_tool?: string;
  referred_by_code?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  registration_url?: string; // Full URL (path + query params) where user registered from
}

export interface WaitlistStats {
  total_signups: number;
  pending_count: number;
  released_count: number;
  declined_count: number;
  converted_count: number;
  avg_referrals: number;
  signups_last_7_days: number;
  signups_last_30_days: number;
}

export interface ToolAnalytics {
  dialers: Record<string, number>;
  meeting_recorders: Record<string, number>;
  crms: Record<string, number>;
  task_managers: Record<string, number>;
}

export interface WaitlistPosition {
  signup_position: number;
  effective_position: number;
  referral_count: number;
  referral_code: string;
  email: string;
  full_name: string;
  total_points?: number;
}

export interface WaitlistFilters {
  status?: WaitlistStatus | 'all';
  dialer_tool?: string;
  meeting_recorder_tool?: string;
  crm_tool?: string;
  task_manager_tool?: string;
  date_from?: string;
  date_to?: string;
  search?: string; // Search by name, email, or company
}

// Tool options for form dropdowns
export const DIALER_OPTIONS = [
  'JustCall',
  'CloudTalk',
  'Aircall',
  'RingCentral Contact Center',
  'Five9',
  '8x8 Contact Center',
  'Dialpad',
  'Talkdesk',
  'Nextiva',
  'Channels',
  'Other',
  'None'
] as const;

export const MEETING_RECORDER_OPTIONS = [
  'Fireflies.ai',
  'Fathom',
  'Otter.ai',
  'Read.ai',
  'tl;dv',
  'Notta',
  'Sembly AI',
  'Grain',
  'Mem',
  'BuildBetter.ai',
  'Other',
  'None'
] as const;

export const CRM_OPTIONS = [
  'Salesforce',
  'HubSpot CRM',
  'Zoho CRM',
  'Pipedrive',
  'Microsoft Dynamics 365',
  'Freshsales',
  'Monday Sales CRM',
  'Insightly',
  'Bullhorn',
  'Capsule CRM',
  'Other',
  'None'
] as const;

export const TASK_MANAGER_OPTIONS = [
  'Monday',
  'Jira',
  'Coda',
  'Asana',
  'Teams',
  'Trello',
  'Other',
  'None'
] as const;

export type DialerTool = typeof DIALER_OPTIONS[number];
export type MeetingRecorderTool = typeof MEETING_RECORDER_OPTIONS[number];
export type CRMTool = typeof CRM_OPTIONS[number];
export type TaskManagerTool = typeof TASK_MANAGER_OPTIONS[number];

// ============================================================================
// Gamification Types
// ============================================================================

export type TierName = 'VIP' | 'Priority' | 'Early Bird';
export type SharePlatform = 'twitter' | 'linkedin' | 'email' | 'copy';
export type MilestoneType = 'first_share' | 'first_referral' | 'tier_upgrade' | 'top_50' | 'referral_5' | 'position_jump_25';

export interface WaitlistTier {
  name: TierName;
  threshold: number; // Minimum position for this tier
  badge: string; // Icon/emoji
  color: string; // Primary color for gradients
  benefits: string[];
}

export interface WaitlistShare {
  id: string;
  waitlist_entry_id: string;
  platform: SharePlatform;
  shared_at: string;
  referral_clicked: boolean;
  referral_converted: boolean;
}

export interface WaitlistMilestone {
  type: MilestoneType;
  achieved_at: string;
  badge: string;
  title: string;
  description: string;
}

export interface ShareStats {
  total_shares: number;
  twitter_shares: number;
  linkedin_shares: number;
  email_shares: number;
  copy_shares: number;
  clicks: number;
  conversions: number;
  conversion_rate: number;
}

// ============================================================================
// Tier Configuration
// ============================================================================

export const TIER_CONFIG: WaitlistTier[] = [
  {
    name: 'VIP',
    threshold: 1,
    badge: '🥇',
    color: '#FFD700',
    benefits: [
      'First access to platform',
      'Dedicated onboarding specialist',
      'Priority feature requests',
      '50% lifetime discount'
    ]
  },
  {
    name: 'Priority',
    threshold: 51,
    badge: '⭐',
    color: '#C0C0C0',
    benefits: [
      'Week 1 access',
      'Priority support',
      'Early feature access',
      '50% lifetime discount'
    ]
  },
  {
    name: 'Early Bird',
    threshold: 201,
    badge: '🎯',
    color: '#CD7F32',
    benefits: [
      'Week 2 access',
      'Community support',
      'Product updates',
      '50% lifetime discount'
    ]
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getTierForPosition(position: number): WaitlistTier {
  // Find the highest tier threshold that the position qualifies for
  const tier = [...TIER_CONFIG]
    .reverse()
    .find(t => position >= t.threshold);

  return tier || TIER_CONFIG[TIER_CONFIG.length - 1];
}

export function getSpotsToNextTier(currentPosition: number): number | null {
  const currentTier = getTierForPosition(currentPosition);
  const currentTierIndex = TIER_CONFIG.findIndex(t => t.name === currentTier.name);

  // If already in top tier, no next tier
  if (currentTierIndex === 0) return null;

  const nextTier = TIER_CONFIG[currentTierIndex - 1];
  return currentPosition - nextTier.threshold;
}

export function getProgressToNextTier(currentPosition: number): number {
  const spotsToNext = getSpotsToNextTier(currentPosition);
  if (spotsToNext === null) return 100; // Already at top tier

  const currentTier = getTierForPosition(currentPosition);
  const currentTierIndex = TIER_CONFIG.findIndex(t => t.name === currentTier.name);
  const nextTier = TIER_CONFIG[currentTierIndex - 1];

  // Calculate progress percentage
  const tierRange = currentTier.threshold - nextTier.threshold;
  const progress = ((tierRange - spotsToNext) / tierRange) * 100;

  return Math.max(0, Math.min(100, progress));
}
