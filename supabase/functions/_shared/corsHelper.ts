// supabase/functions/_shared/corsHelper.ts
// Allowlist-based CORS helper for secure cross-origin requests

/**
 * Get the list of allowed origins from environment or use defaults.
 * Production should use ALLOWED_ORIGINS env var with comma-separated list.
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
  
  // Default allowed origins (includes localhost for development)
  const frontendUrl = Deno.env.get('FRONTEND_URL') || '';
  const defaults = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];
  
  if (frontendUrl && !defaults.includes(frontendUrl)) {
    defaults.push(frontendUrl);
  }
  
  // Add production domains
  const prodDomains = [
    'https://sixty.io',
    'https://www.sixty.io',
    'https://app.sixty.io',
    'https://sixty-sales-dashboard.vercel.app',
  ];
  
  return [...defaults, ...prodDomains];
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === origin) return true;
    // Wildcard subdomain match (e.g., *.vercel.app)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin.endsWith('.' + domain);
    }
    return false;
  });
}

/**
 * Get CORS headers for a request.
 * Returns null if origin is not allowed (for non-preflight requests).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  
  // If no origin header, it's likely a same-origin or server-to-server request
  // Allow these through but don't set CORS headers
  if (!origin) {
    return {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-cron-secret, x-internal-call',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
  }
  
  // Check if origin is allowed
  if (isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-cron-secret, x-internal-call',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  
  // Origin not allowed - return empty origin to block the request
  console.warn(`[CORS] Blocked request from origin: ${origin}`);
  return {
    'Access-Control-Allow-Origin': '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method !== 'OPTIONS') {
    return null;
  }
  
  const corsHeaders = getCorsHeaders(req);
  return new Response('ok', { 
    status: 204,
    headers: corsHeaders 
  });
}

/**
 * Create a JSON response with proper CORS headers
 */
export function jsonResponse(
  data: unknown, 
  req: Request, 
  status: number = 200
): Response {
  const corsHeaders = getCorsHeaders(req);
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create an error response with proper CORS headers
 */
export function errorResponse(
  message: string,
  req: Request,
  status: number = 400
): Response {
  return jsonResponse({ error: message }, req, status);
}

/**
 * Legacy CORS headers (wildcard) - for backwards compatibility only
 * @deprecated Use getCorsHeaders() instead
 */
export const legacyCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

