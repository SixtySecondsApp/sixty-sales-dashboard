import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, authUtils, type Session, type User, type AuthError } from '../supabase/clientV2';
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
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (profileFetchInProgress.current) {
      logger.log('Profile fetch already in progress, skipping');
      return null;
    }
    
    profileFetchInProgress.current = true;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching profile:', error);
        return null;
      }

      if (!profile) {
        // Create default profile for new users
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user?.email,
            first_name: user?.user_metadata?.first_name || 'User',
            last_name: user?.user_metadata?.last_name || '',
            role: 'Junior',
            department: 'Sales'
          })
          .select()
          .single();

        if (createError) {
          logger.error('Error creating profile:', createError);
          return null;
        }
        
        return newProfile;
      }

      return profile;
    } finally {
      profileFetchInProgress.current = false;
    }
  }, [user]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let isInitialLoad = true;

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
              const profile = await fetchUserProfile(session.user.id);
              if (mounted) {
                setUserProfile(profile);
              }
            } else {
              // Check for mock user in development
              const isDevelopment = import.meta.env.MODE === 'development';
              const allowMockUser = import.meta.env.VITE_ALLOW_MOCK_USER === 'true';
              
              logger.log('🔍 Checking mock user:', { 
                isDevelopment, 
                allowMockUser, 
                mockUserInitialized: mockUserInitialized.current,
                hasUserProfile: !!userProfile 
              });
              
              if (isDevelopment || allowMockUser) {
                // Always try to load/create mock user in development mode
                let mockProfile: UserProfile | null = null;
                
                // First, try to load from localStorage
                const existingMockUser = localStorage.getItem('sixty_mock_users');
                if (existingMockUser) {
                  try {
                    mockProfile = JSON.parse(existingMockUser)[0];
                    logger.log('📦 Found existing mock user in localStorage');
                  } catch (e) {
                    logger.error('Failed to parse mock user from localStorage:', e);
                  }
                }
                
                // If no mock user in localStorage, create one
                if (!mockProfile) {
                  mockProfile = {
                    id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
                    email: 'andrew.bryce@sixtyseconds.video',
                    first_name: 'Andrew',
                    last_name: 'Bryce',
                    full_name: 'Andrew Bryce',
                    avatar_url: null,
                    role: 'Senior',
                    department: 'Sales',
                    stage: 'Senior',
                    is_admin: true,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                    username: null,
                    website: null
                  } as UserProfile;
                  
                  // Store in localStorage for persistence
                  localStorage.setItem('sixty_mock_users', JSON.stringify([mockProfile]));
                  logger.log('⚠️ Created new mock user for development');
                }
                
                // Always set the mock user if we don't have a userProfile
                if (mounted && mockProfile) {
                  setUserProfile(mockProfile);
                  // Also set a mock user object for consistency
                  setUser({
                    id: mockProfile.id,
                    email: mockProfile.email || '',
                    app_metadata: {},
                    user_metadata: {
                      full_name: mockProfile.full_name,
                      first_name: mockProfile.first_name,
                      last_name: mockProfile.last_name
                    },
                    aud: 'authenticated',
                    created_at: mockProfile.created_at
                  } as User);
                  logger.log('✅ Mock user profile set:', { 
                    id: mockProfile.id, 
                    email: mockProfile.email,
                    role: mockProfile.role 
                  });
                  mockUserInitialized.current = true;
                }
              }
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
              setUserProfile(profile);
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
      const profile = await fetchUserProfile(user.id);
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
  // Check both real session and mock user profile
  const isAuthenticated = authUtils.isAuthenticated(session) || !!userProfile;
  const userId = authUtils.getUserId(session) || userProfile?.id || null;

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