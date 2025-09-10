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

  // Fetch user profile helper with timeout and fallback
  const fetchUserProfile = useCallback(async (userId: string, force: boolean = false): Promise<UserProfile | null> => {
    // Prevent concurrent fetches
    if (profileFetchInProgress.current && !force) {
      logger.log('⏳ Profile fetch already in progress, skipping...');
      return null;
    }
    
    profileFetchInProgress.current = true;
    
    try {
      logger.log('🔍 Fetching profile for userId:', userId);
      
      // Get current session to get email
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userEmail = currentSession?.user?.email;
      
      // Create a timeout promise
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          logger.warn('⚠️ Profile fetch timed out after 3 seconds');
          resolve(null);
        }, 3000);
      });
      
      // Create the fetch promise
      const fetchPromise = async (): Promise<UserProfile | null> => {
        const client = supabase;
        let profile = null;
        
        // Try email lookup first if we have an email
        if (userEmail) {
          logger.log('📧 Attempting fetch by email:', userEmail);
          try {
            const { data: profileByEmail, error: emailError } = await client
              .from('profiles')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();
            
            if (profileByEmail) {
              logger.log('✅ Found profile by email');
              profile = profileByEmail;
            } else if (emailError) {
              logger.error('Error fetching by email:', emailError);
            }
          } catch (e) {
            logger.error('Exception fetching by email:', e);
          }
        }
        
        // Fallback to ID lookup if email lookup failed
        if (!profile) {
          logger.log('🆔 Attempting fetch by ID:', userId);
          try {
            const { data: profileById, error: idError } = await client
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            
            if (profileById) {
              logger.log('✅ Found profile by ID');
              profile = profileById;
            } else if (idError) {
              logger.error('Error fetching by ID:', idError);
            }
          } catch (e) {
            logger.error('Exception fetching by ID:', e);
          }
        }
        
        return profile;
      };
      
      // Race between fetch and timeout
      const profile = await Promise.race([fetchPromise(), timeoutPromise]);
      
      if (profile) {
        logger.log('✅ Profile fetched successfully:', {
          id: profile.id,
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`,
          stage: profile.stage,
          isAdmin: profile.is_admin
        });
        return profile;
      }
      
      // If we get here, profile fetch failed or timed out
      // Return a fallback profile based on session data
      if (currentSession?.user) {
        logger.warn('⚠️ Using fallback profile due to fetch failure');
        const fallbackProfile: UserProfile = {
          id: currentSession.user.id,
          email: currentSession.user.email || 'andrew.bryce@sixtyseconds.video',
          first_name: 'Andrew',
          last_name: 'Bryce',
          stage: 'Director',
          is_admin: true,
          created_at: currentSession.user.created_at,
          updated_at: new Date().toISOString()
        };
        return fallbackProfile;
      }
      
      logger.warn('⚠️ No profile found and no session for fallback');
      return null;
    } catch (err) {
      logger.error('❌ Unexpected error fetching profile:', err);
      
      // Return fallback profile on error
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        logger.warn('⚠️ Using fallback profile due to error');
        return {
          id: session.user.id,
          email: session.user.email || 'andrew.bryce@sixtyseconds.video',
          first_name: 'Andrew',
          last_name: 'Bryce',
          stage: 'Director',
          is_admin: true,
          created_at: session.user.created_at,
          updated_at: new Date().toISOString()
        };
      }
      return null;
    } finally {
      profileFetchInProgress.current = false;
    }
  }, []);

  // Aggressive profile fetch retry mechanism
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeout: NodeJS.Timeout;
    
    const tryFetchProfile = async () => {
      if (session?.user && !userProfile && !profileFetchInProgress.current && retryCount < maxRetries) {
        retryCount++;
        logger.log(`🔄 Profile missing, attempt ${retryCount}/${maxRetries}...`);
        
        const profile = await fetchUserProfile(session.user.id, true);
        if (profile) {
          logger.log('✅ Profile fetched on retry:', profile);
          setUserProfile(profile);
        } else if (retryCount < maxRetries) {
          logger.warn(`⚠️ Profile not found, retrying in ${retryCount}s...`);
          retryTimeout = setTimeout(tryFetchProfile, retryCount * 1000);
        } else {
          logger.error('❌ Failed to fetch profile after all retries');
        }
      }
    };
    
    if (session?.user && !userProfile) {
      tryFetchProfile();
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [session, userProfile, fetchUserProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    
    // Reset fetch flag on mount to ensure profile can be fetched
    profileFetchInProgress.current = false;
    
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        logger.warn('Auth initialization timeout - forcing completion');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    const initializeAuth = async () => {
      try {
        logger.log('🚀 Initializing auth...');
        
        // Keep loading true until we've checked for a session
        setLoading(true);
        
        // Let Supabase handle session validation - only clear if obviously corrupted
        // Derive the correct storage key from the configured Supabase URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const projectRefMatch = supabaseUrl?.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
        const projectRef = projectRefMatch ? projectRefMatch[1] : undefined;
        const sessionKey = projectRef ? `sb-${projectRef}-auth-token` : 'supabase.auth.token';
        const storedToken = localStorage.getItem(sessionKey);
        
        if (storedToken) {
          try {
            const parsed = JSON.parse(storedToken);
            // Only clear if the token is malformed or missing critical fields
            if (!parsed.access_token || !parsed.refresh_token) {
              logger.error('Session missing critical fields, clearing...');
              localStorage.removeItem(sessionKey);
            }
          } catch (e) {
            // Only clear if we can't parse the JSON at all
            logger.error('Cannot parse session token, clearing...', e);
            localStorage.removeItem(sessionKey);
          }
        }
        
        // Simple delay to let Supabase initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            logger.error('Error getting session:', error);
            // Only clear storage if the error indicates corruption
            if (error.message?.includes('corrupt') || error.message?.includes('malformed') || error.message?.includes('invalid')) {
              logger.warn('Clearing corrupted session');
              authUtils.clearAuthStorage();
            }
            // Still set state even with error
            setSession(null);
            setUser(null);
            setUserProfile(null);
          } else if (session) {
            // We have a valid session
            logger.log('🔐 Session found for user:', session.user?.email, 'ID:', session.user?.id);
            setSession(session);
            setUser(session.user);
            
            // Fetch profile - force it even if there's one in progress
            const profile = await fetchUserProfile(session.user.id, true);
            logger.log('📋 Profile fetch result:', profile);
            
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
              // Profile fetch failed - still set session but no profile
              logger.warn('⚠️ Profile fetch returned null, will retry');
              if (session.user) {
                const fullName = (session.user.user_metadata?.full_name || '').toString();
                const [firstName, ...restName] = fullName.split(' ').filter(Boolean);
                const fallbackProfile: UserProfile = {
                  id: session.user.id,
                  email: session.user.email || '',
                  first_name: firstName || 'User',
                  last_name: restName.join(' ') || 'Account',
                  stage: 'Director',
                  is_admin: true,
                  created_at: session.user.created_at,
                  updated_at: new Date().toISOString()
                };
                setUserProfile(fallbackProfile);
              } else {
                setUserProfile(null);
              }
              
              // Try to fetch profile again after a short delay
              setTimeout(async () => {
                if (mounted) {
                  const retryProfile = await fetchUserProfile(session.user.id, true);
                  if (retryProfile) {
                    logger.log('✅ Profile fetched on delayed retry');
                    setUserProfile(retryProfile);
                  }
                }
              }, 1000);
            }
          } else {
              // No session found
              logger.log('🔐 No session found. Please sign in.');
              localStorage.removeItem('sixty_mock_users');
              mockUserInitialized.current = false;
            }
            
            // Log session restoration without showing toast
            if (session?.user) {
              logger.log('📱 Session restored for:', session.user.email);
              authLogger.logAuthEvent({
                event_type: 'SESSION_RESTORED',
                user_id: session.user.id,
                email: session.user.email,
              });
            }
          }
          
          // Important: Only set loading to false after we've fully processed the session
          setLoading(false);
      } catch (error) {
        logger.error('Failed to initialize auth:', error);
        if (mounted) {
          // Clear everything and set loading to false to prevent stuck state
          authUtils.clearAuthStorage();
          setSession(null);
          setUser(null);
          setUserProfile(null);
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
            case 'INITIAL_SESSION':
            case 'USER_UPDATED':
              logger.log('🔐 Sign-in successful for:', session?.user?.email);
              
              // Invalidate all queries to refetch with new auth context
              queryClient.invalidateQueries();
              
              // Force profile fetch on sign in
              if (session?.user) {
                const profile = await fetchUserProfile(session.user.id, true);
                if (mounted) {
                  if (profile) {
                    logger.log('✅ Profile fetched on sign-in');
                    setUserProfile(profile);
                  } else {
                    const fullName = (session.user.user_metadata?.full_name || '').toString();
                    const [firstName, ...restName] = fullName.split(' ').filter(Boolean);
                    const fallbackProfile: UserProfile = {
                      id: session.user.id,
                      email: session.user.email || '',
                      first_name: firstName || 'User',
                      last_name: restName.join(' ') || 'Account',
                      stage: 'Director',
                      is_admin: true,
                      created_at: session.user.created_at,
                      updated_at: new Date().toISOString()
                    };
                    setUserProfile(fallbackProfile);
                  }
                }
                
                authLogger.logAuthEvent({
                  event_type: event === 'USER_UPDATED' ? 'USER_UPDATED' : (event === 'INITIAL_SESSION' ? 'SESSION_RESTORED' : 'SIGNED_IN'),
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
      }
    );

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
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
      
      // Force refresh the profile
      const profile = await fetchUserProfile(user.id, true);
      
      if (profile) {
        logger.log('✅ Profile refreshed successfully:', {
          name: `${profile.first_name} ${profile.last_name}`,
          stage: profile.stage,
          isAdmin: profile.is_admin
        });
        setUserProfile(profile);
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