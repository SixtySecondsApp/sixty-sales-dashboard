import logger from '@/lib/utils/logger';

// Environment detection and configuration
// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

const isLocalhost = isBrowser 
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  : (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');

const isProduction = isBrowser
  ? window.location.hostname.includes('vercel.app') || !isLocalhost
  : process.env.NODE_ENV === 'production';

// Get Supabase URL from environment variables
const getSupabaseUrl = () => {
  return import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PUBLIC_SUPABASE_URL;
};

// API configuration - Always use Supabase Edge Functions
const getApiBaseUrl = () => {
  // If environment variable is explicitly set, use it
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Always use Supabase Edge Functions for API calls
  const supabaseUrl = getSupabaseUrl();
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`;
  }
  
  // Fallback - should not happen if environment is properly configured
  logger.error('⚠️ VITE_SUPABASE_URL not found. Please check your environment variables.');
  return '/api'; // Fallback to relative path
};

// Temporary flag to disable Edge Functions after Neon -> Supabase migration
// Setting to false to use Edge Functions for stages
export const DISABLE_EDGE_FUNCTIONS = false;

export const API_BASE_URL = DISABLE_EDGE_FUNCTIONS 
  ? '/api'
  : (import.meta.env.VITE_SUPABASE_URL 
    ? `${import.meta.env.VITE_SUPABASE_URL.replace('/rest/v1', '')}/functions/v1`
    : '');

// Database configuration (using Supabase only)
export const config = {
  isLocalhost,
  isProduction,
  // Add debug mode
  debug: !isProduction,
  supabaseUrl: getSupabaseUrl(),
};

// Helper to log configuration in development
if (config.debug && isBrowser) {
  logger.log('🔧 Configuration:', {
    hostname: window.location.hostname,
    isLocalhost: config.isLocalhost,
    isProduction: config.isProduction,
    debug: config.debug,
    disableEdgeFunctions: DISABLE_EDGE_FUNCTIONS,
    apiBaseUrl: API_BASE_URL,
    supabaseUrl: config.supabaseUrl,
    note: DISABLE_EDGE_FUNCTIONS ? 'Using local /api endpoints' : 'Using Supabase Edge Functions for all API calls'
  });
} 