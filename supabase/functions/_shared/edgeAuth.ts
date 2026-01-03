import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export type AuthMode = 'service_role' | 'user' | 'cron';

export type AuthContext = {
  mode: AuthMode;
  userId: string | null;
  isPlatformAdmin: boolean;
};

const DEFAULT_INTERNAL_DOMAIN = 'sixtyseconds.video';

function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

async function isInternalEmailDomain(
  supabase: ReturnType<typeof createClient>,
  email: string | null | undefined
): Promise<boolean> {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  try {
    const { data, error } = await supabase
      .from('internal_email_domains')
      .select('domain')
      .eq('domain', domain)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      // If table doesn't exist yet, use the bootstrap domain as the safe default.
      if ((error as any)?.code === '42P01') {
        return domain === DEFAULT_INTERNAL_DOMAIN;
      }
      console.error('[edgeAuth] Failed to check internal_email_domains:', error);
      return false;
    }

    // If the table exists but is empty/missing this domain, treat as external.
    return !!data;
  } catch (e) {
    console.error('[edgeAuth] Exception checking internal email domain:', e);
    return false;
  }
}

/**
 * Extract bearer token from Authorization header
 */
function normalizeBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const v = authHeader.trim();
  if (!v.toLowerCase().startsWith('bearer ')) return null;
  // Some proxies / runtimes can append additional auth schemes or duplicate values
  // in a single Authorization header, comma-separated. We always treat the first
  // Bearer token as the credential.
  const remainder = v.slice('bearer '.length).trim();
  // Split on comma OR any whitespace (defensive parsing).
  const firstToken = remainder.split(/[,\s]+/)[0]?.trim() ?? '';
  return firstToken || null;
}

/**
 * Check if the request is authenticated with a service role key (exact match)
 */
export function isServiceRoleAuth(authHeader: string | null, serviceRoleKey: string): boolean {
  const token = normalizeBearer(authHeader);
  if (!token) return false;
  // IMPORTANT: Exact match only - no partial/includes checks
  return token === serviceRoleKey;
}

/**
 * Verify cron secret for scheduled jobs.
 * FAIL-CLOSED: Returns false if CRON_SECRET is not set or doesn't match.
 */
export function verifyCronSecret(req: Request, cronSecret: string | undefined): boolean {
  // Fail closed: if no cron secret is configured, reject all cron requests
  if (!cronSecret || cronSecret.trim() === '') {
    console.error('[edgeAuth] CRON_SECRET not configured - rejecting cron request');
    return false;
  }
  
  const providedSecret = req.headers.get('x-cron-secret');
  if (!providedSecret) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (cronSecret.length !== providedSecret.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < cronSecret.length; i++) {
    result |= cronSecret.charCodeAt(i) ^ providedSecret.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Get authentication context from request.
 * Supports user JWT, service role key, and optional cron secret.
 */
export async function getAuthContext(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  serviceRoleKey: string,
  options?: { cronSecret?: string }
): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization');

  // Check for service role authentication (exact match)
  if (isServiceRoleAuth(authHeader, serviceRoleKey)) {
    return { mode: 'service_role', userId: null, isPlatformAdmin: true };
  }

  // Check for cron authentication if cron secret is provided
  if (options?.cronSecret && verifyCronSecret(req, options.cronSecret)) {
    return { mode: 'cron', userId: null, isPlatformAdmin: false };
  }

  const token = normalizeBearer(authHeader);
  if (!token) {
    throw new Error('Unauthorized: missing Authorization header');
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Unauthorized: invalid session');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  const isInternal = await isInternalEmailDomain(supabase, user.email);
  return {
    mode: 'user',
    userId: user.id,
    isPlatformAdmin: isInternal && profile?.is_admin === true,
  };
}

/**
 * Authenticate a request and return userId.
 * For service-role calls, userId must be provided in the request body.
 * For user calls, userId is derived from the JWT.
 */
export async function authenticateRequest(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  serviceRoleKey: string,
  bodyUserId?: string
): Promise<{ userId: string; mode: AuthMode }> {
  const authHeader = req.headers.get('Authorization');

  // Check for service role authentication
  if (isServiceRoleAuth(authHeader, serviceRoleKey)) {
    if (!bodyUserId) {
      throw new Error('userId required in body for service-role calls');
    }
    return { userId: bodyUserId, mode: 'service_role' };
  }

  // User JWT authentication
  const token = normalizeBearer(authHeader);
  if (!token) {
    throw new Error('Unauthorized: missing Authorization header');
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Unauthorized: invalid session');
  }

  return { userId: user.id, mode: 'user' };
}

/**
 * Require organization membership with specific roles
 */
export async function requireOrgRole(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  allowedRoles: Array<'owner' | 'admin' | 'member' | 'readonly'>
): Promise<void> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  if (error || !data?.role) {
    throw new Error('Unauthorized: not a member of this organization');
  }

  if (!allowedRoles.includes(data.role)) {
    throw new Error('Unauthorized: insufficient permissions for this organization');
  }
}

/**
 * Get the user's organization ID (first membership found)
 * Returns null if user has no org membership - callers should decide how to handle
 */
export async function getUserOrgId(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return membership?.org_id || null;
}


