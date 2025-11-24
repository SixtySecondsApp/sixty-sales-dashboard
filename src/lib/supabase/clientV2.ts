import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Database } from '../database.types';
import logger from '@/lib/utils/logger';

// Environment variables with validation
// Supabase uses "Publishable key" (frontend-safe) and "Secret keys" (server-side only)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY; // Publishable key (safe for frontend)
// SECURITY: Never use Secret keys (formerly service role keys) in frontend code!
// Secret keys bypass RLS and should NEVER be exposed to the browser.
// The supabaseAdmin client should only be used server-side (edge functions, API routes).
const supabaseSecretKey = undefined; // Removed: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabasePublishableKey) {
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname.includes('vercel.app') || 
     window.location.hostname.includes('sixtyseconds.video'));
  
  const errorMessage = isProduction
    ? 'Missing required Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Dashboard → Settings → Environment Variables, then redeploy.'
    : 'Missing required Supabase environment variables. Please check your .env.local file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.';
  
  throw new Error(errorMessage);
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
    // Prefer dedicated Functions domain to avoid fetch issues
    const functionsUrlEnv = (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
    let functionsUrl = functionsUrlEnv;
    if (!functionsUrl && supabaseUrl.includes('.supabase.co')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        functionsUrl = `https://${projectRef}.functions.supabase.co`;
      }
    }

    supabaseInstance = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        // Removed custom storageKey to use default sb-[project-ref]-auth-token format
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce', // PKCE for better security
        // Disable debug logging to prevent memory and performance issues
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
      functions: functionsUrl ? { url: functionsUrl } : undefined,
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
      logger.error('Supabase client proxy error:', error);
      throw error;
    }
  }
});

/**
 * Get the admin Supabase client for secret key operations
 * 
 * SECURITY WARNING: This should NOT be used in frontend code!
 * Secret keys (formerly service role keys) bypass Row Level Security and should NEVER be exposed to the browser.
 * 
 * This client should only be used in:
 * - Server-side code (Node.js scripts)
 * - Edge functions (Supabase Edge Functions)
 * - API routes (Vercel serverless functions)
 * 
 * For frontend operations, use the regular `supabase` client which uses the Publishable key and respects RLS.
 */
function getSupabaseAdminClient(): TypedSupabaseClient {
  // SECURITY: Admin client should not be available in frontend
  // If you need admin operations, use edge functions or API routes instead
  console.warn(
    '⚠️ SECURITY WARNING: supabaseAdmin should not be used in frontend code. ' +
    'Secret keys bypass RLS and expose your database. ' +
    'Use edge functions or API routes for admin operations instead.'
  );
  
  // Return regular client instead of admin client
  // This prevents accidental exposure of secret keys
  return getSupabaseClient();
}

/**
 * Admin Supabase client for secret key operations - Proxy wrapper for safe initialization
 * 
 * NOTE: This client is disabled in frontend code for security.
 * Use edge functions or API routes for operations requiring secret keys.
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
      logger.error('Supabase admin client proxy error:', error);
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
    // Check real Supabase authentication first
    if (!!session?.user && !!session?.access_token) {
      return true;
    }
    
    // In development mode, allow mock user authentication
    if (process.env.NODE_ENV === 'development') {
      // Check if mock user data exists in localStorage
      const mockUsers = localStorage.getItem('sixty_mock_users');
      if (mockUsers) {
        try {
          const users = JSON.parse(mockUsers);
          return users.length > 0;
        } catch (e) {
          // If parsing fails, fall back to false
        }
      }
    }
    
    return false;
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
    const status = error.status || error.statusCode || 0;
    
    // Handle specific HTTP status codes
    if (status === 403) {
      return 'Access denied. You may not have permission to access this resource. Please check your account status or contact support.';
    }
    
    if (status === 401) {
      return 'Authentication required. Please sign in to continue.';
    }
    
    if (status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    if (status === 500) {
      // Log detailed error for debugging
      console.error('Supabase 500 Error Details:', {
        message,
        status,
        error: error
      });
      
      return 'Server error occurred. Possible causes: 1) User account may not exist - check Supabase Dashboard → Authentication → Users, 2) Temporary Supabase service issue - try again in a moment, 3) Project configuration issue - verify Supabase project settings. Check browser console for details.';
    }

    // Common error message improvements
    const errorMappings: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and click the confirmation link before signing in.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'User already registered': 'An account with this email already exists. Try signing in instead.',
      'Invalid email address': 'Please enter a valid email address.',
      'signups not allowed': 'New registrations are currently disabled. Please contact support.',
      'JWT expired': 'Your session has expired. Please sign in again.',
      'JWT malformed': 'Authentication error. Please sign in again.',
      'permission denied': 'You do not have permission to perform this action.',
      'insufficient_privilege': 'Insufficient privileges for this operation.',
      'row-level security violation': 'Access denied. You can only access your own data.',
    };

    return errorMappings[message] || message;
  },

  /**
   * Check if an error is an authentication/authorization error
   */
  isAuthError: (error: any): boolean => {
    if (!error) return false;
    
    const status = error.status || error.statusCode || 0;
    const message = (error.message || '').toLowerCase();
    
    return (
      status === 401 || 
      status === 403 ||
      message.includes('jwt') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('row-level security')
    );
  },

  /**
   * Handle authentication errors with appropriate user feedback
   */
  handleAuthError: (error: any, context?: string): void => {
    logger.error(`Authentication error${context ? ` in ${context}` : ''}:`, error);
    
    const isAuth = authUtils.isAuthError(error);
    const userMessage = authUtils.formatAuthError(error);
    
    if (isAuth) {
      // For auth errors, provide specific guidance
      logger.warn('Authentication/Authorization error detected:', {
        error: error.message,
        status: error.status,
        context
      });
    }
    
    // The calling code should display userMessage to the user
    return;
  },

  /**
   * Refresh the current session and retry operation
   */
  refreshAndRetry: async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      // First try to refresh the session
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        logger.error('Session refresh failed:', refreshError);
        throw refreshError;
      }
      
      if (!session) {
        throw new Error('No valid session after refresh');
      }
      
      logger.log('Session refreshed successfully, retrying operation');
      
      // Retry the original operation
      return await operation();
    } catch (error) {
      logger.error('Refresh and retry failed:', error);
      throw error;
    }
  },

  /**
   * Clear all auth storage (useful for complete logout)
   */
  clearAuthStorage: (): void => {
    try {
      // Clear all auth-related localStorage items
      // Using the actual key format that Supabase v2 uses
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      const keysToRemove = [
        `sb-${projectRef}-auth-token`, // Current Supabase v2 format
        'sb.auth.v2', // Old custom key
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
  },

  /**
   * Check current session health and provide diagnostics
   */
  diagnoseSession: async (): Promise<{
    isValid: boolean;
    session: Session | null;
    user: User | null;
    issues: string[];
  }> => {
    const issues: string[] = [];
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        issues.push(`Session error: ${error.message}`);
        return { isValid: false, session: null, user: null, issues };
      }
      
      if (!session) {
        issues.push('No active session found');
        return { isValid: false, session: null, user: null, issues };
      }
      
      if (!session.access_token) {
        issues.push('Session missing access token');
      }
      
      if (!session.user) {
        issues.push('Session missing user data');
      }
      
      // Check if session is expired
      const now = Date.now() / 1000;
      if (session.expires_at && session.expires_at < now) {
        issues.push('Session has expired');
      }
      
      const isValid = issues.length === 0;
      
      return {
        isValid,
        session,
        user: session.user || null,
        issues
      };
    } catch (error) {
      issues.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, session: null, user: null, issues };
    }
  }
}; 