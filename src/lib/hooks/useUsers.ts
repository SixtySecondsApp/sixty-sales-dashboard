import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { setImpersonationData } from './useUser';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import logger from '@/lib/utils/logger';

// Mock implementation - temporarily disabled Supabase calls to avoid 400 errors
// TODO: Implement with Neon API when user management functionality is needed

export interface Target {
  id?: string;
  user_id?: string;
  revenue_target: number | null;
  outbound_target: number | null;
  meetings_target: number | null;
  proposal_target: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  stage: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_internal: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  targets: Target[];
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      // Get current user first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        logger.log('No authenticated user');
        setUsers([]);
        return;
      }

      // Skip RPC function as it doesn't exist in this database
      logger.log('Using direct profiles query method');
      
      // Fallback: Query profiles and get auth info via edge function
      // Explicitly select columns to avoid RLS issues with select('*')
      // Note: profiles table has first_name and last_name, NOT full_name
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, stage, avatar_url, is_admin, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Fetch internal users status
      const { data: internalUsers, error: internalUsersError } = await supabase
        .from('internal_users')
        .select('email, is_active')
        .eq('is_active', true);

      if (internalUsersError) {
        logger.warn('Failed to fetch internal users:', internalUsersError);
      }

      // Create a Set of internal user emails for quick lookup
      const internalEmails = new Set(
        (internalUsers || [])
          .filter(iu => iu.is_active)
          .map(iu => iu.email.toLowerCase())
      );

      // Transform data to match expected User interface
      // Get current user's email from auth session
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const usersData = (profiles || []).map((profile) => {
        const email = profile.email || `user_${profile.id.slice(0, 8)}@private.local`;
        return {
          id: profile.id,
          email,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          stage: profile.stage || 'Trainee', // Use actual stage from profile
          avatar_url: profile.avatar_url,
          is_admin: profile.is_admin || false,
          is_internal: internalEmails.has(email.toLowerCase()),
          created_at: profile.created_at || profile.updated_at || new Date().toISOString(),
          last_sign_in_at: null,
          targets: [] // Will be loaded separately if needed
        };
      });

      setUsers(usersData);
    } catch (error: any) {
      logger.error('Error fetching users:', error);
      if (error.message?.includes('auth.users')) {
        // If auth.users is not accessible, show a more specific message
        toast.error('User management requires additional permissions. Please contact your administrator.');
      } else {
        toast.error('Failed to load users: ' + error.message);
      }
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async ({ userId, updates }: { userId: string; updates: Partial<User> }) => {
    if (!userId) {
      toast.error("Cannot update user: User ID missing.");
      return;
    }
    
    try {
      // Get current user to check if they're trying to remove their own admin status
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Extract targets, is_internal, and profile updates
      const { targets, is_internal, ...profileUpdates } = updates;
      
      // Get user email for internal_users table operations
      const user = users.find(u => u.id === userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Safety check: Prevent users from removing their own admin status
      if (currentUser && currentUser.id === userId && 'is_admin' in profileUpdates) {
        if (profileUpdates.is_admin === false && user.is_admin === true) {
          toast.error('You cannot remove your own admin status. Ask another admin to do this.');
          return;
        }
      }

      // Handle internal user status change
      if (typeof is_internal === 'boolean' && user.email) {
        if (is_internal) {
          // Add to internal_users table
          const { error: insertError } = await supabase
            .from('internal_users')
            .upsert({
              email: user.email.toLowerCase(),
              name: user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`.trim()
                : user.email,
              is_active: true,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'email',
              ignoreDuplicates: false
            });

          if (insertError) {
            throw insertError;
          }
        } else {
          // Remove from internal_users table (set is_active = false)
          const { error: updateError } = await supabase
            .from('internal_users')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('email', user.email.toLowerCase());

          if (updateError) {
            throw updateError;
          }
        }
      }
      
      // Update profile
      if (Object.keys(profileUpdates).length > 0) {
        // Only update allowed profile fields
        const allowedUpdates: Record<string, any> = {};
        if ('first_name' in profileUpdates) {
          allowedUpdates.first_name = profileUpdates.first_name;
        }
        if ('last_name' in profileUpdates) {
          allowedUpdates.last_name = profileUpdates.last_name;
        }
        if ('avatar_url' in profileUpdates) {
          allowedUpdates.avatar_url = profileUpdates.avatar_url;
        }
        if ('is_admin' in profileUpdates) {
          allowedUpdates.is_admin = profileUpdates.is_admin;
        }
        if ('stage' in profileUpdates) {
          allowedUpdates.stage = profileUpdates.stage;
        }
        
        if (Object.keys(allowedUpdates).length > 0) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update(allowedUpdates)
            .eq('id', userId);

          if (profileError) {
            throw profileError;
          }
        }
      }

      toast.success('User updated successfully');
      await fetchUsers();
    } catch (error: any) {
      logger.error('Update error:', error);
      toast.error('Failed to update user: ' + (error.message || 'Unknown error'));
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        throw error;
      }

      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error: any) {
      logger.error('Delete error:', error);
      toast.error('Failed to delete user: ' + (error.message || 'Unknown error'));
    }
  };

  const impersonateUser = async (userId: string) => {
    try {
      // Store current user info before impersonation
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Validate current user has email
      if (!currentUser.email) {
        throw new Error('Current user does not have an email address');
      }

      // Call the impersonate-user edge function to get a magic link
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { 
          userId,
          adminId: currentUser.id,
          adminEmail: currentUser.email,
          redirectTo: getSiteUrl()
        }
      });

      if (error) {
        throw error;
      }

      logger.log('Impersonate response:', data);

      // Check if we got the old response format (email/password)
      if (data?.email && data?.password) {
        logger.warn('Edge Function is returning old format. Using fallback password-based impersonation.');
        
        // Store original user info for restoration
        setImpersonationData(currentUser.id, currentUser.email!);
        
        // Sign in with the temporary password (old method)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password
        });

        if (signInError) {
          throw signInError;
        }

        toast.success('Impersonation started (legacy mode)');
        window.location.reload();
        return;
      }

      if (data?.session) {
        // New session-based impersonation
        // Store original user info for restoration
        setImpersonationData(currentUser.id, currentUser.email!);
        
        // Set the new session directly
        const { error: setSessionError } = await supabase.auth.setSession(data.session);
        
        if (setSessionError) {
          throw setSessionError;
        }
        
        toast.success('Impersonation started successfully!');
        
        // Reload to refresh the app with the new session
        window.location.reload();
      } else if (data?.magicLink) {
        // Fallback to magic link impersonation
        setImpersonationData(currentUser.id, currentUser.email!);
        
        toast.success('Starting impersonation...');
        
        // Redirect to the magic link
        window.location.href = data.magicLink;
      } else {
        logger.error('Unexpected response format:', data);
        throw new Error('Failed to start impersonation. Response: ' + JSON.stringify(data));
      }
    } catch (error: any) {
      logger.error('Impersonation error:', error);
      toast.error('Failed to impersonate user: ' + (error.message || 'Unknown error'));
    }
  };

  return {
    users,
    isLoading,
    updateUser,
    deleteUser,
    impersonateUser,
  };
}