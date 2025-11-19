/**
 * Feature flags for the application
 * 
 * These flags control the rollout of new features and allow for
 * gradual migration and A/B testing.
 */

/**
 * Check if multi-tenant architecture is enabled
 * 
 * When disabled, the app operates in single-tenant mode with a default
 * organization automatically resolved for all users.
 * 
 * @returns true if multi-tenant mode is enabled, false otherwise
 */
export function isMultiTenantEnabled(): boolean {
  return import.meta.env.VITE_MULTI_TENANT_ENABLED === 'true';
}

/**
 * Get the default organization ID for single-tenant mode
 * 
 * This is used when multi-tenant is disabled to automatically
 * resolve the organization for all operations.
 * 
 * @returns the default organization ID or null if not configured
 */
export function getDefaultOrgId(): string | null {
  return import.meta.env.VITE_DEFAULT_ORG_ID || null;
}











