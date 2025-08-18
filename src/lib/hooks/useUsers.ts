import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { setImpersonationData } from './useUser';

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
        console.log('No authenticated user');
        setUsers([]);
        return;
      }

      // Skip RPC function as it doesn't exist in this database
      console.log('Using direct profiles query method');
      
      // Fallback: Query profiles and get auth info via edge function
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform data to match expected User interface
      // Get current user's email from auth session
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const usersData = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email || `user_${profile.id.slice(0, 8)}@private.local`,
        first_name: profile.first_name || profile.full_name?.split(' ')[0] || null,
        last_name: profile.last_name || profile.full_name?.split(' ').slice(1).join(' ') || null,
        stage: profile.stage || 'Trainee', // Use actual stage from profile
        avatar_url: profile.avatar_url,
        is_admin: profile.is_admin || false,
        created_at: profile.created_at || profile.updated_at || new Date().toISOString(),
        last_sign_in_at: null,
        targets: [] // Will be loaded separately if needed
      }));

      setUsers(usersData);
    } catch (error: any) {
      console.error('Error fetching users:', error);
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
      // Extract targets and profile updates
      const { targets, ...profileUpdates } = updates;
      
      // Update profile
      if (Object.keys(profileUpdates).length > 0) {
        // Only update allowed profile fields
        const allowedUpdates: Record<string, any> = {};
        if ('first_name' in profileUpdates || 'last_name' in profileUpdates) {
          allowedUpdates.full_name = [profileUpdates.first_name, profileUpdates.last_name]
            .filter(Boolean)
            .join(' ') || null;
        }
        if ('avatar_url' in profileUpdates) {
          allowedUpdates.avatar_url = profileUpdates.avatar_url;
        }
        
        const { error: profileError } = await supabase
          .from('profiles')
          .update(allowedUpdates)
          .eq('id', userId);

        if (profileError) {
          throw profileError;
        }
      }

      toast.success('User updated successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('Update error:', error);
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
      console.error('Delete error:', error);
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
          redirectTo: window.location.origin
        }
      });

      if (error) {
        throw error;
      }

      console.log('Impersonate response:', data);

      // Check if we got the old response format (email/password)
      if (data?.email && data?.password) {
        console.warn('Edge Function is returning old format. Using fallback password-based impersonation.');
        
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

      if (data?.magicLink) {
        // Store original user info for restoration
        setImpersonationData(currentUser.id, currentUser.email!);
        
        toast.success('Starting impersonation...');
        
        // Redirect to the magic link
        window.location.href = data.magicLink;
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('Failed to generate magic link for impersonation. Response: ' + JSON.stringify(data));
      }
    } catch (error: any) {
      console.error('Impersonation error:', error);
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