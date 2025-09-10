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
  
  // Profile cache to prevent repeated fetches
  const profileCache = useRef<{ 
    profile: UserProfile | null; 
    timestamp: number; 
    email: string | null 
  }>({ 
    profile: null, 
    timestamp: 0,
    email: null 
  });
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Fetch user profile helper - ALWAYS use email as primary lookup
  const fetchUserProfile = useCallback(async (userId: string, force: boolean = false): Promise<UserProfile | null> => {
    try {
      // Get current user email first - this is the most reliable identifier
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email;
      
      if (!userEmail) {
        logger.error('❌ No email found for authenticated user');
        return null;
      }

      // Check cache first (unless forced refresh)
      const now = Date.now();
      if (!force && 
          profileCache.current.email === userEmail && 
          profileCache.current.profile && 
          (now - profileCache.current.timestamp) < CACHE_DURATION) {
        logger.log('📦 Using cached profile for:', userEmail);
        return profileCache.current.profile;
      }
      
      logger.log('🔍 Fetching fresh profile for email:', userEmail);
      
      // Use admin client if available for better access
      const client = supabaseAdmin || supabase;
      
      // ALWAYS fetch by email first - it's the most reliable
      let { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('❌ Error fetching profile by email:', error);
        
        // Fallback: try by ID only if email fails
        logger.log('🔄 Attempting fallback fetch by ID:', userId);
        const { data: profileById, error: idError } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileById) {
          logger.log('✅ Found profile by ID fallback');
          profile = profileById;
        } else if (idError) {
          logger.error('❌ Could not fetch profile by ID either:', idError);
        }
      }

      if (profile) {
        logger.log('✅ Profile fetched successfully:', {
          id: profile.id,
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`,
          stage: profile.stage,
          isAdmin: profile.is_admin
        });
        
        // Cache the result
        profileCache.current = { 
          profile, 
          timestamp: now,
          email: userEmail 
        };
        
        // Ensure all required fields are present
        if (!profile.first_name || !profile.last_name || !profile.stage) {
          logger.warn('⚠️ Profile missing required fields, may need update');
        }
        
        return profile;
      }

      logger.warn('⚠️ No profile found for email:', userEmail);
      
      // Clear cache if no profile found
      profileCache.current = { profile: null, timestamp: 0, email: null };
      
      return null;
    } catch (err) {
      logger.error('❌ Unexpected error fetching profile:', err);
      // Don't show toast for every error - too noisy
      return null;
    }
  }, []);

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
        logger.log('🚀 Initializing auth...');
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
                  logger.log('✅ Setting user profile in state:', {
                    id: profile.id,
                    email: profile.email,
                    firstName: profile.first_name,
                    lastName: profile.last_name,
                    stage: profile.stage,
                    isAdmin: profile.is_admin
                  });
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
      logger.log('🔄 Manual profile refresh requested');
      
      // Clear cache first to ensure fresh fetch
      profileCache.current = { profile: null, timestamp: 0, email: null };
      
      // Force refresh the profile
      const profile = await fetchUserProfile(user.id, true);
      
      if (profile) {
        logger.log('✅ Profile refreshed successfully:', {
          name: `${profile.first_name} ${profile.last_name}`,
          stage: profile.stage,
          isAdmin: profile.is_admin
        });
        setUserProfile(profile);
        
        // Also update the user metadata if needed
        if (user && (!user.user_metadata?.full_name || !user.user_metadata?.stage)) {
          const fullName = `${profile.first_name} ${profile.last_name}`;
          await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              stage: profile.stage,
              is_admin: profile.is_admin
            }
          });
        }
      } else {
        logger.warn('⚠️ Profile refresh failed - no profile found');
        setUserProfile(null);
      }
    } else {
      logger.warn('⚠️ Cannot refresh profile - no user logged in');
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