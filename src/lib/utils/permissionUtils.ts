/**
 * Permission Utilities for 3-Tier Settings Architecture
 *
 * Provides functions to determine user permission tiers and access rights.
 */

import type {
  PermissionTier,
  TierPermissions,
  OrgRole,
  FeatureAccess,
} from '@/lib/types/permissionTypes';

/**
 * Check if user is a Platform Admin (Tier 3)
 * Requires: internal user (email domain) AND is_admin flag
 */
export function isPlatformAdmin(isInternal: boolean, isAdmin: boolean): boolean {
  return isInternal && isAdmin;
}

/**
 * Check if user is an Org Admin (Tier 2)
 * Requires: org role of 'owner' or 'admin'
 */
export function isOrgAdmin(orgRole: OrgRole): boolean {
  return orgRole === 'owner' || orgRole === 'admin';
}

/**
 * Check if user is Org Owner specifically
 */
export function isOrgOwner(orgRole: OrgRole): boolean {
  return orgRole === 'owner';
}

/**
 * Check if user is an Org Member (any role in an org)
 */
export function isOrgMember(orgRole: OrgRole): boolean {
  return orgRole !== null;
}

/**
 * Get the highest permission tier for a user
 *
 * Platform Admin > Org Admin > User
 */
export function getPermissionTier(
  isInternal: boolean,
  isAdmin: boolean,
  orgRole: OrgRole
): PermissionTier {
  // Tier 3: Platform Admin (internal + is_admin)
  if (isPlatformAdmin(isInternal, isAdmin)) {
    return 'platformAdmin';
  }

  // Tier 2: Org Admin (org owner/admin role)
  if (isOrgAdmin(orgRole)) {
    return 'orgAdmin';
  }

  // Tier 1: User (everyone else)
  return 'user';
}

/**
 * Permission tier hierarchy for comparison
 */
const TIER_HIERARCHY: Record<PermissionTier, number> = {
  user: 1,
  orgAdmin: 2,
  platformAdmin: 3,
};

/**
 * Check if user has at least the required tier
 */
export function hasMinimumTier(
  userTier: PermissionTier,
  requiredTier: PermissionTier
): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Build complete permissions object for a user
 */
export function buildTierPermissions(
  isInternal: boolean,
  isAdmin: boolean,
  orgRole: OrgRole
): TierPermissions {
  const platform = isPlatformAdmin(isInternal, isAdmin);
  const orgAdminRole = isOrgAdmin(orgRole);
  const owner = isOrgOwner(orgRole);

  return {
    // Tier 1: All users
    canManageOwnProfile: true,
    canManageOwnPreferences: true,
    canViewOwnUsage: true,

    // Tier 2: Org Admins (or Platform Admins)
    canManageTeam: orgAdminRole || platform,
    canManageBilling: owner || platform,
    canManageOrgSettings: orgAdminRole || platform,
    canManageOrgBranding: orgAdminRole || platform,
    canViewOrgUsage: orgAdminRole || platform,
    canManageOrgIntegrations: orgAdminRole || platform,

    // Tier 3: Platform Admins only
    canManageInternalDomains: platform,
    canManageSubscriptionPlans: platform,
    canManageAllCustomers: platform,
    canAccessPlatformAdmin: platform,
    canViewAsExternal: platform,
    canManageSystemConfig: platform,
    canManagePipeline: platform,
    canManageSmartTasks: platform,
    canManageAISettings: platform,
    canManagePrompts: platform,
    canAccessDevTools: platform,
  };
}

/**
 * Build feature access flags based on user type and permissions
 */
export function buildFeatureAccess(
  isInternal: boolean,
  isAdmin: boolean,
  orgRole: OrgRole
): FeatureAccess {
  const platform = isPlatformAdmin(isInternal, isAdmin);
  const orgAdminRole = isOrgAdmin(orgRole);

  return {
    // Meeting features - available to all users
    meetings: true,
    meetingAnalytics: true,
    teamInsights: true,
    contentTopics: true,

    // CRM features - internal users only
    crm: isInternal,
    pipeline: isInternal,
    deals: isInternal,
    contacts: isInternal,
    companies: isInternal,

    // Workflow features - internal users only
    workflows: isInternal,
    integrations: isInternal,
    tasks: isInternal,
    calendar: isInternal,
    email: isInternal,

    // Admin features
    adminDashboard: platform,
    saasAdmin: platform,
    orgAdmin: orgAdminRole || platform,
    platformAdmin: platform,
  };
}

/**
 * Check if a user can access a specific route based on access level
 */
export function canAccessRoute(
  accessLevel: string,
  isInternal: boolean,
  isAdmin: boolean,
  orgRole: OrgRole
): boolean {
  switch (accessLevel) {
    case 'any':
      return true;

    case 'internal':
      return isInternal;

    case 'external':
      return !isInternal;

    case 'admin':
    case 'platformAdmin':
      // Platform Admin: internal + is_admin
      return isPlatformAdmin(isInternal, isAdmin);

    case 'orgAdmin':
      // Org Admin: org role owner/admin, OR Platform Admin
      return isPlatformAdmin(isInternal, isAdmin) || isOrgAdmin(orgRole);

    default:
      return true;
  }
}

/**
 * Get user-friendly tier label
 */
export function getTierLabel(tier: PermissionTier): string {
  switch (tier) {
    case 'platformAdmin':
      return 'Platform Administrator';
    case 'orgAdmin':
      return 'Organization Administrator';
    case 'user':
      return 'User';
    default:
      return 'Unknown';
  }
}

/**
 * Get user-friendly org role label
 */
export function getOrgRoleLabel(role: OrgRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    case 'readonly':
      return 'Read-only';
    case null:
      return 'No Organization';
    default:
      return 'Unknown';
  }
}
