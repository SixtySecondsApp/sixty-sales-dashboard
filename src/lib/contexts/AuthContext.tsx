import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, authUtils, type Session, type User, type AuthError } from '../supabase/clientV2';
import { authLogger } from '../services/authLogger';
import { toast } from 'sonner';

// Auth context types
interface AuthContextType {
  // State
  user: User | null;
  session: Session | null;
  loading: boolean;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: { full_name?: string }) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  
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
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let isInitialLoad = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            console.error('Error getting session:', error);
            // Clear potentially corrupted session data
            authUtils.clearAuthStorage();
          } else {
            setSession(session);
            setUser(session?.user ?? null);
            
                          // Log session restoration without showing toast
              if (session?.user && isInitialLoad) {
                console.log('📱 Session restored for:', session.user.email);
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
        console.error('Failed to initialize auth:', error);
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
        console.log('Auth state change:', event, !!session);
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Handle specific auth events
          switch (event) {
            case 'SIGNED_IN':
              // Only show success toast for manual sign-ins, not session restoration
              if (!isInitialLoad) {
                toast.success('Successfully signed in!');
                console.log('🔐 Manual sign-in successful for:', session?.user?.email);
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
              // Note: We don't log SIGNED_OUT since we won't have session data
              break;
              
            case 'TOKEN_REFRESHED':
              console.log('Token refreshed successfully');
              // Log token refresh for security monitoring
              if (session?.user) {
                authLogger.logAuthEvent({
                  event_type: 'TOKEN_REFRESHED',
                  user_id: session.user.id,
                });
              }
              break;
              
            case 'PASSWORD_RECOVERY':
              console.log('Password recovery initiated');
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
  }, [queryClient]);

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

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error: { message: authUtils.formatAuthError(error) } };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: authUtils.formatAuthError(error) } };
    }
  }, []);

  // Reset password function
  const resetPassword = useCallback(async (email: string) => {
    try {
      // Determine the correct redirect URL based on environment
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isLocalhost 
        ? 'http://localhost:5173/auth/reset-password'
        : `${window.location.origin}/auth/reset-password`;
      
      console.log('Reset password redirect URL:', redirectUrl);
      
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
  const isAuthenticated = authUtils.isAuthenticated(session);
  const userId = authUtils.getUserId(session);

  const value: AuthContextType = {
    // State
    user,
    session,
    loading,
    
    // Actions
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    
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