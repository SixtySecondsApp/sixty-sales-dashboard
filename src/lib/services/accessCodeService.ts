/**
 * Access Code Validation Service
 * Handles validation of signup invite codes including admin bypass
 * Used to gate account creation (not waitlist signups)
 */

import { supabase } from '@/lib/supabase/clientV2';

// Admin bypass code - easy to remember for internal users
const ADMIN_BYPASS_CODE = 'SIXTY60';

export interface AccessCodeValidationResult {
  isValid: boolean;
  code: string;
  isAdminBypass: boolean;
  error?: string;
}

/**
 * Validate an access code for signup
 * Checks admin bypass first, then database codes
 */
export async function validateAccessCode(code: string): Promise<AccessCodeValidationResult> {
  const normalized = code.trim().toUpperCase();

  // Empty code check
  if (!normalized) {
    return {
      isValid: false,
      code: '',
      isAdminBypass: false,
      error: 'Access code is required'
    };
  }

  // Check admin bypass first (no database call needed)
  if (normalized === ADMIN_BYPASS_CODE) {
    return {
      isValid: true,
      code: normalized,
      isAdminBypass: true
    };
  }

  // Check database for valid code
  try {
    const { data, error } = await supabase
      .from('waitlist_invite_codes')
      .select('code, is_active')
      .ilike('code', normalized)
      .single();

    if (error || !data) {
      return {
        isValid: false,
        code: normalized,
        isAdminBypass: false,
        error: 'Invalid access code'
      };
    }

    // Check if code is active
    if (!data.is_active) {
      return {
        isValid: false,
        code: normalized,
        isAdminBypass: false,
        error: 'This access code is no longer active'
      };
    }

    return {
      isValid: true,
      code: data.code, // Use the stored casing
      isAdminBypass: false
    };
  } catch (err) {
    console.error('Error validating access code:', err);
    return {
      isValid: false,
      code: normalized,
      isAdminBypass: false,
      error: 'Failed to validate access code. Please try again.'
    };
  }
}

/**
 * Get access code from URL query parameter
 * Looks for ?code=XXXX in the current URL
 */
export function getAccessCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

/**
 * Check if the admin bypass code
 */
export function isAdminBypassCode(code: string): boolean {
  return code.trim().toUpperCase() === ADMIN_BYPASS_CODE;
}

/**
 * Increment the usage count for a code (called after successful signup)
 */
export async function incrementCodeUsage(code: string): Promise<void> {
  if (isAdminBypassCode(code)) {
    // Don't track admin bypass usage
    return;
  }

  try {
    await supabase.rpc('increment_invite_code_usage', { code_value: code });
  } catch (err) {
    // Non-critical - log but don't fail signup
    console.error('Failed to increment code usage:', err);
  }
}
