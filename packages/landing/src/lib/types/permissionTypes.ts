/**
 * Permission Types for 3-Tier Settings Architecture
 *
 * Tier 1: User - All authenticated users (personal preferences)
 * Tier 2: Org Admin - Org owners/admins (team management, org settings)
 * Tier 3: Platform Admin - Internal team only (system configuration)
 */

export type PermissionTier = 'user' | 'orgAdmin' | 'platformAdmin';

export type SettingsAccess = 'user' | 'orgAdmin' | 'platformAdmin';

export type OrgRole = 'owner' | 'admin' | 'member' | 'readonly' | null;

export interface TierPermissions {
  // Tier 1: User permissions (all authenticated users)
  canManageOwnProfile: boolean;
  canManageOwnPreferences: boolean;
  canViewOwnUsage: boolean;

  // Tier 2: Org Admin permissions (org owners/admins)
  canManageTeam: boolean;
  canManageBilling: boolean;
  canManageOrgSettings: boolean;
  canManageOrgBranding: boolean;
  canViewOrgUsage: boolean;
  canManageOrgIntegrations: boolean;

  // Tier 3: Platform Admin permissions (internal + is_admin)
  canManageInternalDomains: boolean;
  canManageSubscriptionPlans: boolean;
  canManageAllCustomers: boolean;
  canAccessPlatformAdmin: boolean;
  canViewAsExternal: boolean;
  canManageSystemConfig: boolean;
  canManagePipeline: boolean;
  canManageSmartTasks: boolean;
  canManageAISettings: boolean;
  canManagePrompts: boolean;
  canAccessDevTools: boolean;
}

export interface UserPermissionState {
  // User type detection
  isInternal: boolean;
  isExternal: boolean;
  isAdmin: boolean;

  // Organization context
  orgId: string | null;
  orgRole: OrgRole;

  // Computed permission tier
  permissionTier: PermissionTier;
  tierPermissions: TierPermissions;

  // Convenience flags
  isPlatformAdmin: boolean;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
}

// Route access levels for the 3-tier model
export type RouteAccessLevel =
  | 'any'           // All authenticated users
  | 'internal'      // Internal users only (legacy support)
  | 'external'      // External users only
  | 'admin'         // Legacy - maps to platformAdmin
  | 'orgAdmin'      // Org admins (owner/admin role) or platform admins
  | 'platformAdmin'; // Platform admins only (internal + is_admin)

// Feature flags that can be toggled per tier
export interface FeatureAccess {
  // Meeting features (all users)
  meetings: boolean;
  meetingAnalytics: boolean;
  teamInsights: boolean;
  contentTopics: boolean;

  // CRM features (internal users)
  crm: boolean;
  pipeline: boolean;
  deals: boolean;
  contacts: boolean;
  companies: boolean;

  // Workflow features (internal users)
  workflows: boolean;
  integrations: boolean;
  tasks: boolean;
  calendar: boolean;
  email: boolean;

  // Admin features
  adminDashboard: boolean;
  saasAdmin: boolean;
  orgAdmin: boolean;
  platformAdmin: boolean;
}
