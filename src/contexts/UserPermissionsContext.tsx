/**
 * UserPermissionsContext - Unified Permission Management
 *
 * Provides user type detection (internal vs external) and feature access control.
 * Integrates with AuthContext for user email and OrgContext for organization roles.
 *
 * Features:
 * - Email domain-based user type detection (internal = @sixtyseconds.video)
 * - Feature access flags based on user type
 * - "View as External" toggle for internal users to preview customer experience
 * - Route access control helpers
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg, type OrgRole } from '@/lib/contexts/OrgContext';
import { useUser } from '@/lib/hooks/useUser';
import {
  type UserType,
  type FeatureAccess,
  type ViewModeState,
} from '@/lib/types/userTypes';
import {
  getUserTypeFromEmail,
  getFeatureAccess,
  isRouteAllowed,
  getUnauthorizedRedirect,
  loadInternalDomains,
} from '@/lib/utils/userTypeUtils';
import { isUserAdmin } from '@/lib/utils/adminUtils';

// =====================================================
// Types
// =====================================================

interface UserPermissionsContextType {
  // User type
  userType: UserType;
  isInternal: boolean;
  isExternal: boolean;

  // View mode (for "view as external" toggle)
  viewMode: ViewModeState;
  isViewingAsExternal: boolean;
  effectiveUserType: UserType;

  // Feature access
  featureAccess: FeatureAccess;

  // Admin status
  isAdmin: boolean;

  // Org role
  orgRole: OrgRole | null;

  // Actions
  toggleExternalView: () => void;
  exitExternalView: () => void;

  // Utilities
  canAccessRoute: (pathname: string) => boolean;
  canAccessFeature: (feature: keyof FeatureAccess) => boolean;
  getRedirectForUnauthorized: () => string;
}

// =====================================================
// Context
// =====================================================

const UserPermissionsContext = createContext<UserPermissionsContextType | undefined>(undefined);

// Session storage key for view mode persistence
const EXTERNAL_VIEW_STORAGE_KEY = 'sixty_external_view_mode';

// =====================================================
// Provider Component
// =====================================================

interface UserPermissionsProviderProps {
  children: React.ReactNode;
}

export function UserPermissionsProvider({ children }: UserPermissionsProviderProps) {
  const { user } = useAuth();
  const { userData } = useUser();
  const { userRole } = useOrg();

  // Track when domains are loaded
  const [domainsLoaded, setDomainsLoaded] = useState(false);

  // Load internal domains from database on mount
  useEffect(() => {
    loadInternalDomains()
      .then(() => setDomainsLoaded(true))
      .catch(console.error);
  }, []);

  // Determine actual user type from email
  // Re-evaluate when domains are loaded
  const actualUserType = useMemo(() => {
    return getUserTypeFromEmail(user?.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, domainsLoaded]);

  // View mode state - persisted in session storage
  const [isExternalViewActive, setIsExternalViewActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(EXTERNAL_VIEW_STORAGE_KEY) === 'true';
  });

  // Only internal users can toggle view mode
  // Reset external view if user becomes external
  useEffect(() => {
    if (actualUserType === 'external') {
      setIsExternalViewActive(false);
      sessionStorage.removeItem(EXTERNAL_VIEW_STORAGE_KEY);
    }
  }, [actualUserType]);

  // Persist view mode to session storage
  useEffect(() => {
    if (isExternalViewActive) {
      sessionStorage.setItem(EXTERNAL_VIEW_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(EXTERNAL_VIEW_STORAGE_KEY);
    }
  }, [isExternalViewActive]);

  // Calculate effective user type (considers view toggle)
  const effectiveUserType = useMemo(() => {
    if (actualUserType === 'internal' && isExternalViewActive) {
      return 'external';
    }
    return actualUserType;
  }, [actualUserType, isExternalViewActive]);

  // Build view mode state
  const viewMode: ViewModeState = useMemo(
    () => ({
      isExternalViewActive: actualUserType === 'internal' ? isExternalViewActive : false,
      actualUserType,
      effectiveUserType,
    }),
    [actualUserType, isExternalViewActive, effectiveUserType]
  );

  // Check if user is admin (from profiles table)
  // Must use userData from useUser() which contains the profile with is_admin flag
  const isAdmin = useMemo(() => {
    return isUserAdmin(userData);
  }, [userData]);

  // Calculate feature access
  const featureAccess = useMemo(() => {
    return getFeatureAccess(actualUserType, viewMode, isAdmin);
  }, [actualUserType, viewMode, isAdmin]);

  // Toggle external view mode (only for internal users)
  const toggleExternalView = useCallback(() => {
    if (actualUserType === 'internal') {
      setIsExternalViewActive((prev) => !prev);
    }
  }, [actualUserType]);

  // Exit external view mode
  const exitExternalView = useCallback(() => {
    setIsExternalViewActive(false);
  }, []);

  // Check if a specific route is accessible
  const canAccessRoute = useCallback(
    (pathname: string) => {
      return isRouteAllowed(pathname, effectiveUserType, isAdmin);
    },
    [effectiveUserType, isAdmin]
  );

  // Check if a specific feature is accessible
  const canAccessFeature = useCallback(
    (feature: keyof FeatureAccess) => {
      return featureAccess[feature];
    },
    [featureAccess]
  );

  // Get redirect route for unauthorized access
  const getRedirectForUnauthorized = useCallback(() => {
    return getUnauthorizedRedirect(effectiveUserType);
  }, [effectiveUserType]);

  // Build context value
  const value: UserPermissionsContextType = useMemo(
    () => ({
      // User type
      userType: actualUserType,
      isInternal: actualUserType === 'internal',
      isExternal: actualUserType === 'external',

      // View mode
      viewMode,
      isViewingAsExternal: viewMode.isExternalViewActive,
      effectiveUserType,

      // Feature access
      featureAccess,

      // Admin status
      isAdmin,

      // Org role
      orgRole: userRole,

      // Actions
      toggleExternalView,
      exitExternalView,

      // Utilities
      canAccessRoute,
      canAccessFeature,
      getRedirectForUnauthorized,
    }),
    [
      actualUserType,
      viewMode,
      effectiveUserType,
      featureAccess,
      isAdmin,
      userRole,
      toggleExternalView,
      exitExternalView,
      canAccessRoute,
      canAccessFeature,
      getRedirectForUnauthorized,
    ]
  );

  return (
    <UserPermissionsContext.Provider value={value}>
      {children}
    </UserPermissionsContext.Provider>
  );
}

// =====================================================
// Custom Hooks
// =====================================================

/**
 * Main hook to access user permissions context
 */
export function useUserPermissions(): UserPermissionsContextType {
  const context = useContext(UserPermissionsContext);
  if (context === undefined) {
    throw new Error('useUserPermissions must be used within UserPermissionsProvider');
  }
  return context;
}

/**
 * Get the actual user type (internal/external based on email)
 */
export function useUserType(): UserType {
  return useUserPermissions().userType;
}

/**
 * Get the effective user type (considers "view as external" toggle)
 */
export function useEffectiveUserType(): UserType {
  return useUserPermissions().effectiveUserType;
}

/**
 * Check if user is internal
 */
export function useIsInternal(): boolean {
  return useUserPermissions().isInternal;
}

/**
 * Check if user is external
 */
export function useIsExternal(): boolean {
  return useUserPermissions().isExternal;
}

/**
 * Get feature access flags
 */
export function useFeatureAccess(): FeatureAccess {
  return useUserPermissions().featureAccess;
}

/**
 * Check if a specific feature is accessible
 */
export function useCanAccessFeature(feature: keyof FeatureAccess): boolean {
  return useUserPermissions().featureAccess[feature];
}

/**
 * Check if external view mode is active (internal user viewing as external)
 */
export function useIsViewingAsExternal(): boolean {
  return useUserPermissions().isViewingAsExternal;
}

/**
 * Get toggle function for external view mode
 */
export function useToggleExternalView(): () => void {
  return useUserPermissions().toggleExternalView;
}

/**
 * Check if user can access a specific route
 */
export function useCanAccessRoute(pathname: string): boolean {
  return useUserPermissions().canAccessRoute(pathname);
}
