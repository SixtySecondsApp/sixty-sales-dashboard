/**
 * Route Configuration - Centralized Route Definitions
 *
 * Defines all application routes with their access levels and navigation metadata.
 * Used by RouteGuard for access control and AppLayout for dynamic navigation.
 */

import {
  Activity,
  Video,
  Sparkles,
  Layers,
  BarChart3,
  Building2,
  Kanban,
  CheckSquare,
  Calendar,
  Mail,
  Users,
  Settings,
  Shield,
  Workflow,
  Plug,
  User,
  CreditCard,
  LayoutDashboard,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react';
import { type UserType } from '@/lib/types/userTypes';

// =====================================================
// Types
// =====================================================

export type RouteAccess = 'any' | 'internal' | 'external' | 'admin';

export interface RouteConfig {
  /** Route path */
  path: string;
  /** Access level required */
  access: RouteAccess;
  /** Display label for navigation */
  label?: string;
  /** Icon for navigation */
  icon?: LucideIcon;
  /** Whether to show in navigation sidebar */
  showInNav?: boolean;
  /** Override navigation visibility for specific user types (independent of access) */
  showInNavFor?: 'internal' | 'external';
  /** Navigation section grouping */
  navSection?: 'main' | 'tools' | 'settings' | 'admin';
  /** Order within section (lower = higher in list) */
  order?: number;
  /** Badge text (e.g., "New", "Beta") */
  badge?: string;
}

// =====================================================
// Route Definitions
// =====================================================

export const ROUTE_CONFIGS: RouteConfig[] = [
  // ========== Main Section (External + Internal) ==========
  {
    path: '/',
    access: 'any',
    label: 'Dashboard',
    icon: HeartPulse,
    showInNav: true,
    showInNavFor: 'external', // Only show in navigation for external users
    navSection: 'main',
    order: 1,
  },
  {
    path: '/meetings',
    access: 'any',
    label: 'Meetings',
    icon: Video,
    showInNav: true,
    navSection: 'main',
    order: 2,
  },
  // ========== Internal-Only: Dashboard (Top of Nav) ==========
  {
    path: '/dashboard',
    access: 'internal',
    label: 'Dashboard',
    icon: LayoutDashboard,
    showInNav: true,
    navSection: 'main',
    order: -1, // Ensure this is always first
  },
  {
    path: '/meetings/intelligence',
    access: 'any',
    label: 'Intelligence',
    icon: Sparkles,
    showInNav: true,
    navSection: 'main',
    order: 3,
  },
  {
    path: '/insights/content-topics',
    access: 'any',
    label: 'Content Topics',
    icon: Layers,
    showInNav: true,
    navSection: 'main',
    order: 4,
  },
  {
    path: '/insights/team',
    access: 'any',
    label: 'Team Analytics',
    icon: BarChart3,
    showInNav: true,
    navSection: 'main',
    order: 5,
  },

  // ========== Internal-Only Main Routes ==========
  {
    path: '/crm',
    access: 'internal',
    label: 'CRM',
    icon: Building2,
    showInNav: true,
    navSection: 'main',
    order: 10,
  },
  {
    path: '/pipeline',
    access: 'internal',
    label: 'Pipeline',
    icon: Kanban,
    showInNav: true,
    navSection: 'main',
    order: 11,
  },
  {
    path: '/activity',
    access: 'internal',
    label: 'Activity',
    icon: Activity,
    showInNav: true,
    navSection: 'main',
    order: 12,
  },
  {
    path: '/insights',
    access: 'internal',
    label: 'Insights',
    icon: BarChart3,
    showInNav: true,
    navSection: 'main',
    order: 13,
  },

  // ========== Tools Section (Internal Only) ==========
  {
    path: '/tasks',
    access: 'internal',
    label: 'Tasks',
    icon: CheckSquare,
    showInNav: true,
    navSection: 'tools',
    order: 1,
  },
  {
    path: '/calendar',
    access: 'internal',
    label: 'Calendar',
    icon: Calendar,
    showInNav: true,
    navSection: 'tools',
    order: 2,
  },
  {
    path: '/email',
    access: 'internal',
    label: 'Email',
    icon: Mail,
    showInNav: true,
    navSection: 'tools',
    order: 3,
  },
  {
    path: '/workflows',
    access: 'internal',
    label: 'Workflows',
    icon: Workflow,
    showInNav: true,
    navSection: 'tools',
    order: 4,
  },
  {
    path: '/integrations',
    access: 'internal',
    label: 'Integrations',
    icon: Plug,
    showInNav: true,
    navSection: 'tools',
    order: 5,
  },

  // ========== Settings Section ==========
  {
    path: '/settings',
    access: 'any',
    label: 'Settings',
    icon: Settings,
    showInNav: true,
    navSection: 'settings',
    order: 1,
  },
  {
    path: '/settings/team',
    access: 'any',
    label: 'Team',
    icon: Users,
    showInNav: false,
    navSection: 'settings',
    order: 2,
  },
  {
    path: '/profile',
    access: 'any',
    label: 'Profile',
    icon: User,
    showInNav: false,
    navSection: 'settings',
    order: 3,
  },

  // ========== Admin Section (Internal + Admin Only) ==========
  {
    path: '/admin',
    access: 'admin',
    label: 'Internal Admin',
    icon: Shield,
    showInNav: true,
    navSection: 'admin',
    order: 1,
  },
  {
    path: '/saas-admin',
    access: 'admin',
    label: 'SaaS Admin',
    icon: CreditCard,
    showInNav: true,
    navSection: 'admin',
    order: 2,
    badge: 'New',
  },
];

// =====================================================
// Helper Functions
// =====================================================

/**
 * Get navigation items for a specific user type and section
 */
export function getNavigationItems(
  effectiveUserType: UserType,
  isAdmin: boolean,
  section?: RouteConfig['navSection']
): RouteConfig[] {
  return ROUTE_CONFIGS.filter((route) => {
    // Must be marked for navigation
    if (!route.showInNav) return false;

    // Filter by section if specified
    if (section && route.navSection !== section) return false;

    // Check access level
    if (route.access === 'admin' && !isAdmin) return false;
    if (route.access === 'internal' && effectiveUserType === 'external') return false;
    if (route.access === 'external' && effectiveUserType !== 'external') return false;

    // Check showInNavFor override (controls nav visibility independent of access)
    if (route.showInNavFor) {
      if (route.showInNavFor === 'external' && effectiveUserType !== 'external') return false;
      if (route.showInNavFor === 'internal' && effectiveUserType === 'external') return false;
    }

    return true;
  }).sort((a, b) => (a.order || 999) - (b.order || 999));
}

/**
 * Get all navigation sections with their items
 */
export function getNavigationSections(
  effectiveUserType: UserType,
  isAdmin: boolean
): Array<{ section: string; items: RouteConfig[] }> {
  const sections: RouteConfig['navSection'][] = ['main', 'tools', 'settings', 'admin'];

  return sections
    .map((section) => ({
      section: section || 'main',
      items: getNavigationItems(effectiveUserType, isAdmin, section),
    }))
    .filter((s) => s.items.length > 0);
}

/**
 * Get route config by path
 */
export function getRouteConfig(path: string): RouteConfig | undefined {
  // First try exact match
  const exactMatch = ROUTE_CONFIGS.find((r) => r.path === path);
  if (exactMatch) return exactMatch;

  // Try prefix match for nested routes (e.g., /meetings/123 matches /meetings)
  const sortedConfigs = [...ROUTE_CONFIGS].sort((a, b) => b.path.length - a.path.length);
  return sortedConfigs.find(
    (r) => path.startsWith(r.path) && (r.path === '/' ? path === '/' : true)
  );
}

/**
 * Check if a route requires internal access
 */
export function isInternalRoute(path: string): boolean {
  const config = getRouteConfig(path);
  return config?.access === 'internal' || config?.access === 'admin';
}

/**
 * Check if a route requires admin access
 */
export function isAdminRoute(path: string): boolean {
  const config = getRouteConfig(path);
  return config?.access === 'admin';
}

/**
 * Get the default route for a user type
 */
export function getDefaultRoute(effectiveUserType: UserType): string {
  return effectiveUserType === 'external' ? '/meetings' : '/';
}
