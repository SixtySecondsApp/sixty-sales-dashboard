import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin, authUtils, type Session, type User, type AuthError } from '../supabase/clientV2';
import { authLogger } from '../services/authLogger';
import { toast } from 'sonner';
import { getAuthRedirectUrl } from '@/lib/utils/siteUrl';
import logger from '@/lib/utils/logger';
import type { Database } from '@/lib/database.types';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

// Auth context types
interface AuthContextType {
  // State
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: { full_name?: string }) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  refreshProfile: () => Promise<void>;
  
  // Utilities
  isAuthenticated: boolean;
  userId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const profileFetchInProgress = useRef(false);
  const mockUserInitialized = useRef(false);

  // Fetch user profile helper
  const fetchUserProfile = useCallback(async (userId: string, force: boolean = false): Promise<UserProfile | null> => {
    if (profileFetchInProgress.current && !force) {
      logger.log('Profile fetch already in progress, skipping');
      return null;
    }
    
    profileFetchInProgress.current = true;
    logger.log('🔍 Fetching profile for user:', userId);
    
    try {
      // Try with service role key for better access
      const client = supabaseAdmin || supabase;
      
      logger.log('🔎 Attempting to fetch profile for userId:', userId);
      logger.log('Using admin client:', !!supabaseAdmin);
      
      const { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to handle no rows gracefully

      logger.log('Profile fetch result:', { profile, error });

      if (error && error.code !== 'PGRST116') {
        logger.error('❌ Error fetching profile:', error);
        toast.error('Failed to load user profile. Please try refreshing the page.');
        return null;
      }

      // If no profile exists, try to fetch it directly by email
      if (!profile) {
        logger.log('📝 No profile found by ID, trying by email...');
        
        // Get current user data
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser?.email) {
          const { data: profileByEmail } = await client
            .from('profiles')
            .select('*')
            .eq('email', currentUser.email)
            .maybeSingle();
            
          if (profileByEmail) {
            logger.log('✅ Found profile by email:', profileByEmail);
            
            // Update the profile ID to match the auth user ID if different
            if (profileByEmail.id !== userId) {
              logger.log('🔄 Updating profile ID to match auth user ID');
              const { data: updatedProfile, error: updateError } = await client
                .from('profiles')
                .update({ id: userId })
                .eq('email', currentUser.email)
                .select()
                .single();
                
              if (updateError) {
                logger.error('Failed to update profile ID:', updateError);
                return profileByEmail; // Return the profile anyway
              }
              
              return updatedProfile;
            }
            
            return profileByEmail;
          }
        }
        
        // Don't create a new profile - just log that we couldn't find one
        logger.log('⚠️ No profile found for user:', userId, 'email:', currentUser?.email);
        return null;
      }

      logger.log('✅ Profile fetched successfully:', profile);
      return profile;
    } catch (err) {
      logger.error('❌ Unexpected error fetching profile:', err);
      toast.error('An unexpected error occurred. Please try refreshing the page.');
      return null;
    } finally {
      profileFetchInProgress.current = false;
    }
  }, [user]);

  // Add retry mechanism for profile fetch
  useEffect(() => {
    if (session?.user && !userProfile && !profileFetchInProgress.current) {
      logger.log('🔄 Retrying profile fetch for user:', session.user.id);
      fetchUserProfile(session.user.id, true).then(profile => {
        if (profile) {
          logger.log('✅ Profile retry successful:', profile);
          setUserProfile(profile);
        }
      });
    }
  }, [session, userProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let isInitialLoad = true;
    
    // Reset fetch flag on mount to ensure profile can be fetched
    profileFetchInProgress.current = false;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            logger.error('Error getting session:', error);
            // Clear potentially corrupted session data
            authUtils.clearAuthStorage();
          } else {
            setSession(session);
            setUser(session?.user ?? null);
            
            // Fetch profile if we have a user
            if (session?.user) {
              logger.log('🔐 Session found for user:', session.user.email, 'ID:', session.user.id);
              const profile = await fetchUserProfile(session.user.id);
              logger.log('📋 Profile fetch result:', profile);
              if (mounted) {
                if (profile) {
                  logger.log('✅ Setting user profile:', profile);
                  setUserProfile(profile);
                } else {
                  // Don't set fallback data - wait for proper profile
                  logger.log('⚠️ Profile fetch returned null, will retry on next render');
                  setUserProfile(null);
                }
              }
            } else {
              // No session found - don't use mock user
              logger.log('🔐 No session found. Please sign in with your Supabase account.');
              
              // Clear any existing mock user data
              localStorage.removeItem('sixty_mock_users');
              mockUserInitialized.current = false;
            }
            
            // Log session restoration without showing toast
            if (session?.user && isInitialLoad) {
              logger.log('📱 Session restored for:', session.user.email);
              authLogger.logAuthEvent({
                event_type: 'SIGNED_IN',
                user_id: session.user.id,
                email: session.user.email,
              });
            }
          }
          setLoading(false);
        }
      } catch (error) {
        logger.error('Failed to initialize auth:', error);
        if (mounted) {
          authUtils.clearAuthStorage();
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state change:', event, !!session);
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Update profile when session changes
          if (session?.user && event !== 'TOKEN_REFRESHED') {
            const profile = await fetchUserProfile(session.user.id);
            if (mounted) {
              if (profile) {
                logger.log('✅ Setting user profile from auth state change:', profile);
                setUserProfile(profile);
              } else {
                logger.log('⚠️ Profile fetch failed in auth state change, will retry');
                // Don't set fallback - let it retry
                setUserProfile(null);
              }
            }
          } else if (!session) {
            setUserProfile(null);
          }
          
          // Handle specific auth events
          switch (event) {
            case 'SIGNED_IN':
              // Only log for manual sign-ins, not session restoration
              if (!isInitialLoad) {
                logger.log('🔐 Manual sign-in successful for:', session?.user?.email);
              }
              
              // Invalidate all queries to refetch with new auth context
              queryClient.invalidateQueries();
              
              // Log auth event
              if (session?.user) {
                authLogger.logAuthEvent({
                  event_type: 'SIGNED_IN',
                  user_id: session.user.id,
                  email: session.user.email,
                });
              }
              break;
              
            case 'SIGNED_OUT':
              toast.success('Successfully signed out!');
              // Clear all cached data
              queryClient.clear();
              authUtils.clearAuthStorage();
              // Clear mock user data
              localStorage.removeItem('sixty_mock_users');
              mockUserInitialized.current = false;
              setUserProfile(null);
              // Note: We don't log SIGNED_OUT since we won't have session data
              break;
              
            case 'TOKEN_REFRESHED':
              logger.log('Token refreshed successfully');
              // Log token refresh for security monitoring
              if (session?.user) {
                authLogger.logAuthEvent({
                  event_type: 'TOKEN_REFRESHED',
                  user_id: session.user.id,
                });
              }
              break;
              
            case 'PASSWORD_RECOVERY':
              logger.log('Password recovery initiated');
              if (session?.user) {
                authLogger.logAuthEvent({
                  event_type: 'PASSWORD_RECOVERY',
                  user_id: session.user.id,
                  email: session.user.email,
                });
              }
              break;
              
            default:
              break;
          }
          
          setLoading(false);
        }
        
        // Mark that initial load is complete
        isInitialLoad = false;
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient, fetchUserProfile]);

  // Sign in function
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        return { error: { message: authUtils.formatAuthError(error) } };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: authUtils.formatAuthError(error) } };
    }
  }, []);

  // Sign up function
  const signUp = useCallback(async (email: string, password: string, metadata?: { full_name?: string }) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: metadata || {},
        },
      });

      if (error) {
        return { error: { message: authUtils.formatAuthError(error) } };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: authUtils.formatAuthError(error) } };
    }
  }, []);

  // Refresh profile function
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const profile = await fetchUserProfile(user.id, true); // Force refresh
      setUserProfile(profile);
    }
  }, [user, fetchUserProfile]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      // Clear mock user data if it exists
      localStorage.removeItem('sixty_mock_users');
      mockUserInitialized.current = false;
      
      // Clear any other auth-related storage
      authUtils.clearAuthStorage();
      
      // Clear profile
      setUserProfile(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        // Even if there's an error, clear local data
        localStorage.removeItem('sixty_mock_users');
        authUtils.clearAuthStorage();
        
        // Force reload to clear state
        window.location.href = '/auth/login';
        return { error: null }; // Return success since we're forcing a reload
      }

      // Force navigation to login page
      window.location.href = '/auth/login';
      
      return { error: null };
    } catch (error) {
      // Force clear everything and reload
      localStorage.removeItem('sixty_mock_users');
      authUtils.clearAuthStorage();
      window.location.href = '/auth/login';
      return { error: null };
    }
  }, []);

  // Reset password function
  const resetPassword = useCallback(async (email: string) => {
    try {
      // Use helper function to get correct redirect URL
      const redirectUrl = getAuthRedirectUrl('/auth/reset-password');
      
      logger.log('Reset password redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { error: { message: authUtils.formatAuthError(error) } };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: authUtils.formatAuthError(error) } };
    }
  }, []);

  // Update password function
  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        return { error: { message: authUtils.formatAuthError(error) } };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: authUtils.formatAuthError(error) } };
    }
  }, []);

  // Computed values
  // Only check real session for authentication
  const isAuthenticated = authUtils.isAuthenticated(session);
  const userId = authUtils.getUserId(session);

  const value: AuthContextType = {
    // State
    user,
    session,
    userProfile,
    loading,
    
    // Actions
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
    
    // Utilities
    isAuthenticated,
    userId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 