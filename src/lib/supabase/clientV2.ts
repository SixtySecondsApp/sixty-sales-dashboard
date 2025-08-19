import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Database } from '../database.types';

// Environment variables with validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables. Please check your .env.local file.'
  );
}

// Typed Supabase client
export type TypedSupabaseClient = SupabaseClient<Database>;

// Create singleton instances to prevent multiple client issues
let supabaseInstance: TypedSupabaseClient | null = null;
let supabaseAdminInstance: TypedSupabaseClient | null = null;

/**
 * Get the main Supabase client for user operations
 * Uses lazy initialization to avoid vendor bundle issues
 */
function getSupabaseClient(): TypedSupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'sb.auth.v2', // Versioned storage key
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce', // PKCE for better security
        // Enhanced debug mode for better error tracking
        debug: false,
        storage: {
          getItem: (key: string) => {
            try {
              return localStorage.getItem(key);
            } catch {
              return null;
            }
          },
          setItem: (key: string, value: string) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              // Silently fail if localStorage is not available
            }
          },
          removeItem: (key: string) => {
            try {
              localStorage.removeItem(key);
            } catch {
              // Silently fail if localStorage is not available
            }
          }
        }
      },
      global: {
        headers: {
          'X-Client-Info': 'sales-dashboard-v2'
        }
      }
    });
  }
  return supabaseInstance;
}

/**
 * Main Supabase client for user operations - Proxy wrapper for safe initialization
 */
export const supabase: TypedSupabaseClient = new Proxy({} as TypedSupabaseClient, {
  get(target, prop) {
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized');
      }
      const value = client[prop as keyof TypedSupabaseClient];
      return typeof value === 'function' ? value.bind(client) : value;
    } catch (error) {
      console.error('Supabase client proxy error:', error);
      throw error;
    }
  }
});

/**
 * Get the admin Supabase client for service role operations
 * Uses lazy initialization to avoid vendor bundle issues
 */
function getSupabaseAdminClient(): TypedSupabaseClient {
  if (!supabaseAdminInstance && supabaseServiceKey) {
    supabaseAdminInstance = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false, // Don't persist admin sessions
        autoRefreshToken: false, // Disable auto refresh for admin
        storageKey: 'sb.auth.admin.v2' // Separate storage key
      },
      global: {
        headers: {
          'X-Client-Info': 'sales-dashboard-admin-v2'
        }
      }
    });
  }
  return supabaseAdminInstance || getSupabaseClient(); // Fallback to regular client if no service key
}

/**
 * Admin Supabase client for service role operations - Proxy wrapper for safe initialization
 */
export const supabaseAdmin: TypedSupabaseClient = new Proxy({} as TypedSupabaseClient, {
  get(target, prop) {
    try {
      const client = getSupabaseAdminClient();
      if (!client) {
        throw new Error('Supabase admin client not initialized');
      }
      const value = client[prop as keyof TypedSupabaseClient];
      return typeof value === 'function' ? value.bind(client) : value;
    } catch (error) {
      console.error('Supabase admin client proxy error:', error);
      throw error;
    }
  }
});

// Export types for use in other files
export type { Session, User };
export type AuthError = {
  message: string;
  status?: number;
};

// Utility functions for common auth operations
export const authUtils = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated: (session: Session | null): boolean => {
    return !!session?.user && !!session?.access_token;
  },

  /**
   * Get user ID from session
   */
  getUserId: (session: Session | null): string | null => {
    return session?.user?.id || null;
  },

  /**
   * Format auth error messages for user display
   */
  formatAuthError: (error: any): string => {
    if (!error) return 'An unknown error occurred';
    
    const message = error.message || error.error_description || 'Authentication failed';
    
    // Common error message improvements
    const errorMappings: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and click the confirmation link before signing in.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'User already registered': 'An account with this email already exists. Try signing in instead.',
      'Invalid email address': 'Please enter a valid email address.',
      'signups not allowed': 'New registrations are currently disabled. Please contact support.',
    };

    return errorMappings[message] || message;
  },

  /**
   * Clear all auth storage (useful for complete logout)
   */
  clearAuthStorage: (): void => {
    try {
      // Clear all auth-related localStorage items
      const keysToRemove = [
        'sb.auth.v2',
        'sb.auth.admin.v2',
        'supabase.auth.token', // Legacy key
        'sb-refresh-token',
        'sb-access-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch {
      // Silently fail if localStorage is not available
    }
  }
}; 