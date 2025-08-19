// Environment detection and configuration
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isProduction = window.location.hostname.includes('vercel.app') || !isLocalhost;

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
  console.error('⚠️ VITE_SUPABASE_URL not found. Please check your environment variables.');
  return '/api'; // Fallback to relative path
};

// Temporary flag to disable Edge Functions after Neon -> Supabase migration
export const DISABLE_EDGE_FUNCTIONS = true;

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
if (config.debug) {
  console.log('🔧 Configuration:', {
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