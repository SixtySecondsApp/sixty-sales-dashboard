// supabase/functions/_shared/cors.ts
// 
// DEPRECATED: This file uses wildcard CORS which is insecure for production.
// For new code, use corsHelper.ts instead:
//   import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHelper.ts';
//
// This file is kept for backwards compatibility with existing functions.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // DEPRECATED: Use corsHelper.ts for allowlist-based CORS
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, x-cron-secret, x-internal-call',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset'
} 