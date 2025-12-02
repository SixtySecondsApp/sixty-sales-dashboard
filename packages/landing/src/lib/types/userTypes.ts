/**
 * User Type System
 *
 * Distinguishes between internal (Sixty team) and external (customer) users
 * based on email domain. This is the foundation for feature access control.
 */

// User type - derived from email domain at runtime
export type UserType = 'internal' | 'external';

// Internal email domains - users with these domains get full access
export const INTERNAL_DOMAINS = ['sixtyseconds.video'] as const;

// Feature access flags - what each user type can access
export interface FeatureAccess {
  // Meetings features (available to all users)
  meetings: boolean;
  meetingAnalytics: boolean;
  teamInsights: boolean;
  contentTopics: boolean;

  // CRM features (internal only)
  crm: boolean;
  pipeline: boolean;
  deals: boolean;
  contacts: boolean;
  companies: boolean;

  // Admin features (internal + admin only)
  adminDashboard: boolean;
  saasAdmin: boolean;
  userManagement: boolean;
  systemSettings: boolean;

  // Workflow features (internal only)
  workflows: boolean;
  integrations: boolean;
  tasks: boolean;
  calendar: boolean;
  email: boolean;
}

// View mode state - for internal users viewing as external
export interface ViewModeState {
  // True when internal user is actively viewing external mode
  isExternalViewActive: boolean;
  // The real user type (always based on email)
  actualUserType: UserType;
  // What they're currently viewing as (considers toggle state)
  effectiveUserType: UserType;
}

// Combined permission context type
export interface UserPermissions {
  userType: UserType;
  viewMode: ViewModeState;
  featureAccess: FeatureAccess;
  isAdmin: boolean;
  orgRole: 'owner' | 'admin' | 'member' | 'readonly' | null;
}

// Default feature access for external users (meetings only)
export const EXTERNAL_FEATURE_ACCESS: FeatureAccess = {
  // Meetings features - YES
  meetings: true,
  meetingAnalytics: true,
  teamInsights: true,
  contentTopics: false, // Disabled - feature not ready for external users

  // CRM features - NO
  crm: false,
  pipeline: false,
  deals: false,
  contacts: false,
  companies: false,

  // Admin features - NO
  adminDashboard: false,
  saasAdmin: false,
  userManagement: false,
  systemSettings: false,

  // Workflow features - NO
  workflows: false,
  integrations: false,
  tasks: false,
  calendar: false,
  email: false,
};

// Default feature access for internal users (full access, admin features depend on role)
export const INTERNAL_FEATURE_ACCESS: FeatureAccess = {
  // Meetings features - YES
  meetings: true,
  meetingAnalytics: true,
  teamInsights: true,
  contentTopics: true,

  // CRM features - YES
  crm: true,
  pipeline: true,
  deals: true,
  contacts: true,
  companies: true,

  // Admin features - depends on is_admin flag (set separately)
  adminDashboard: false, // Will be overridden based on admin status
  saasAdmin: false,
  userManagement: false,
  systemSettings: false,

  // Workflow features - YES
  workflows: true,
  integrations: true,
  tasks: true,
  calendar: true,
  email: true,
};
