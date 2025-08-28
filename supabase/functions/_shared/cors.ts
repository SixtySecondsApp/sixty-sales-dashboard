// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // IMPORTANT: Restrict this in production!
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // Support all HTTP methods
  'Access-Control-Expose-Headers': 'x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset'
} 