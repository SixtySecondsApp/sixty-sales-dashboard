/**
 * FeatureGate - Conditional Rendering by Feature Access
 *
 * Renders children only if the user has access to the specified feature.
 * Useful for hiding UI elements based on user type (internal vs external).
 */

import React from 'react';
import { type FeatureAccess } from '@/lib/types/userTypes';
import { useCanAccessFeature } from '@/contexts/UserPermissionsContext';

interface FeatureGateProps {
  /** The feature to check access for */
  feature: keyof FeatureAccess;
  /** Content to render if user has access */
  children: React.ReactNode;
  /** Optional content to render if user doesn't have access */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children based on feature access
 *
 * @example
 * ```tsx
 * <FeatureGate feature="crm">
 *   <CRMLink />
 * </FeatureGate>
 *
 * <FeatureGate feature="adminDashboard" fallback={<UpgradePrompt />}>
 *   <AdminLink />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const hasAccess = useCanAccessFeature(feature);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook version for programmatic feature checks
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const hasCRM = useFeatureGate('crm');
 *
 *   if (!hasCRM) {
 *     return <UpgradePrompt />;
 *   }
 *
 *   return <CRMContent />;
 * }
 * ```
 */
export function useFeatureGate(feature: keyof FeatureAccess): boolean {
  return useCanAccessFeature(feature);
}

/**
 * Higher-order component version for wrapping entire components
 *
 * @example
 * ```tsx
 * const ProtectedCRM = withFeatureGate('crm', CRMPage, UnauthorizedPage);
 * ```
 */
export function withFeatureGate<P extends object>(
  feature: keyof FeatureAccess,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureGatedComponent(props: P) {
    const hasAccess = useCanAccessFeature(feature);

    if (!hasAccess) {
      if (FallbackComponent) {
        return <FallbackComponent {...props} />;
      }
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Component that renders children only for internal users
 *
 * @example
 * ```tsx
 * <InternalOnly>
 *   <AdminToolbar />
 * </InternalOnly>
 * ```
 */
export function InternalOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  // CRM is a good proxy for internal-only access since it's only available to internal users
  return (
    <FeatureGate feature="crm" fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

/**
 * Component that renders children only for admin users
 *
 * @example
 * ```tsx
 * <AdminOnly>
 *   <SystemSettings />
 * </AdminOnly>
 * ```
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <FeatureGate feature="adminDashboard" fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export default FeatureGate;
