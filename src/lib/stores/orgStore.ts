/**
 * Organization Store
 * 
 * Manages the active organization (tenant) for the current user session.
 * Provides organization switching, membership management, and org-aware utilities.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/clientV2';
import { isMultiTenantEnabled, getDefaultOrgId } from '@/lib/utils/featureFlags';
import logger from '@/lib/utils/logger';

export interface Organization {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface OrganizationMembership {
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'readonly';
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

interface OrgStore {
  // State
  activeOrgId: string | null;
  organizations: Organization[];
  memberships: OrganizationMembership[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setActiveOrg: (orgId: string | null) => void;
  loadOrganizations: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization | null>;
  getActiveOrg: () => Organization | null;
  getUserRole: (orgId: string) => 'owner' | 'admin' | 'member' | 'readonly' | null;
  isOrgMember: (orgId: string) => boolean;
  clear: () => void;
}

export const useOrgStore = create<OrgStore>()(
  persist(
    (set, get) => ({
      // Initial state
      activeOrgId: null,
      organizations: [],
      memberships: [],
      isLoading: false,
      error: null,

      /**
       * Set the active organization
       */
      setActiveOrg: (orgId: string | null) => {
        logger.log('[OrgStore] Setting active org:', orgId);
        set({ activeOrgId: orgId });
      },

      /**
       * Load organizations and memberships for the current user
       */
      loadOrganizations: async () => {
        const { isLoading } = get();
        if (isLoading) return; // Prevent concurrent loads

        set({ isLoading: true, error: null });

        try {
          // If multi-tenant is disabled, we don't need organizations table
          if (!isMultiTenantEnabled()) {
            const defaultOrgId = getDefaultOrgId();
            if (defaultOrgId) {
              // Use the default org ID without querying the table
              logger.log('[OrgStore] Multi-tenant disabled, using default org ID:', defaultOrgId);
              set({
                activeOrgId: defaultOrgId,
                organizations: [],
                memberships: [],
                isLoading: false,
                error: null,
              });
              return;
            }

            // No default org configured and multi-tenant is disabled
            // Use a placeholder/null orgId - the app should work without it
            logger.log('[OrgStore] Multi-tenant disabled, no default org configured - using null orgId');
            set({
              activeOrgId: null,
              organizations: [],
              memberships: [],
              isLoading: false,
              error: null,
            });
            return;
          }

          // Multi-tenant enabled: fetch user's memberships
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ isLoading: false, error: 'User not authenticated' });
            return;
          }

          // Fetch memberships with organization details
          const { data: memberships, error: membershipsError } = await supabase
            .from('organization_memberships')
            .select(`
              *,
              organization:organizations(*)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (membershipsError) throw membershipsError;

          const orgMemberships: OrganizationMembership[] = (memberships || []).map((m: any) => ({
            org_id: m.org_id,
            user_id: m.user_id,
            role: m.role,
            created_at: m.created_at,
            updated_at: m.updated_at,
            organization: m.organization,
          }));

          const orgs: Organization[] = orgMemberships
            .map((m) => m.organization)
            .filter((org): org is Organization => org !== undefined);

          // Set active org if not already set or if current active org is not in list
          let activeOrgId = get().activeOrgId;
          if (!activeOrgId || !orgs.find((o) => o.id === activeOrgId)) {
            activeOrgId = orgs.length > 0 ? orgs[0].id : null;
          }

          set({
            activeOrgId,
            organizations: orgs,
            memberships: orgMemberships,
            isLoading: false,
            error: null,
          });

          logger.log('[OrgStore] Loaded organizations:', {
            count: orgs.length,
            activeOrgId,
          });
        } catch (error: any) {
          logger.error('[OrgStore] Error loading organizations:', error);
          set({
            isLoading: false,
            error: error.message || 'Failed to load organizations',
          });
        }
      },

      /**
       * Refresh organizations (reload from server)
       */
      refreshOrganizations: async () => {
        await get().loadOrganizations();
      },

      /**
       * Create a new organization
       */
      createOrganization: async (name: string): Promise<Organization | null> => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('User not authenticated');
          }

          // Create organization
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({
              name: name.trim(),
              created_by: user.id,
              is_active: true,
            })
            .select()
            .single();

          if (orgError) throw orgError;

          // Create membership as owner
          const { error: membershipError } = await supabase
            .from('organization_memberships')
            .insert({
              org_id: org.id,
              user_id: user.id,
              role: 'owner',
            });

          if (membershipError) throw membershipError;

          // Refresh organizations
          await get().refreshOrganizations();

          // Set as active org
          get().setActiveOrg(org.id);

          logger.log('[OrgStore] Created organization:', org.id);
          return org;
        } catch (error: any) {
          logger.error('[OrgStore] Error creating organization:', error);
          set({ error: error.message || 'Failed to create organization' });
          return null;
        }
      },

      /**
       * Get the active organization
       */
      getActiveOrg: (): Organization | null => {
        const { activeOrgId, organizations } = get();
        if (!activeOrgId) return null;
        return organizations.find((o) => o.id === activeOrgId) || null;
      },

      /**
       * Get user's role in an organization
       */
      getUserRole: (orgId: string): 'owner' | 'admin' | 'member' | 'readonly' | null => {
        const { memberships } = get();
        const membership = memberships.find((m) => m.org_id === orgId);
        return membership?.role || null;
      },

      /**
       * Check if user is a member of an organization
       */
      isOrgMember: (orgId: string): boolean => {
        return get().getUserRole(orgId) !== null;
      },

      /**
       * Clear all organization data
       */
      clear: () => {
        set({
          activeOrgId: null,
          organizations: [],
          memberships: [],
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'org-store', // localStorage key
      partialize: (state) => ({
        activeOrgId: state.activeOrgId, // Only persist activeOrgId
      }),
    }
  )
);

/**
 * Hook to get the active organization ID
 * Returns the active org ID or null, with fallback for single-tenant mode
 */
export function useActiveOrgId(): string | null {
  const activeOrgId = useOrgStore((state) => state.activeOrgId);
  const { getActiveOrg } = useOrgStore();

  // If multi-tenant is disabled, return default or first org
  if (!isMultiTenantEnabled()) {
    const defaultOrgId = getDefaultOrgId();
    if (defaultOrgId) return defaultOrgId;

    const activeOrg = getActiveOrg();
    return activeOrg?.id || null;
  }

  return activeOrgId;
}

/**
 * Hook to get the active organization
 */
export function useActiveOrg(): Organization | null {
  return useOrgStore((state) => state.getActiveOrg());
}

/**
 * Hook to check if user has a specific role in the active org
 */
export function useHasOrgRole(
  role: 'owner' | 'admin' | 'member' | 'readonly'
): boolean {
  const activeOrgId = useActiveOrgId();
  const getUserRole = useOrgStore((state) => state.getUserRole);

  if (!activeOrgId) return false;

  const userRole = getUserRole(activeOrgId);
  if (!userRole) return false;

  // Role hierarchy: owner > admin > member > readonly
  const roleHierarchy: Record<string, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    readonly: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[role];
}












