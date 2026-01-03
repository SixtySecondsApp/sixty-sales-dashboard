/**
 * Impersonation State Utilities
 *
 * Extracted to avoid circular imports between useUser.ts and auditContext.ts
 */

// Session storage keys
const ORIGINAL_USER_ID_KEY = 'originalUserId';
const ORIGINAL_USER_EMAIL_KEY = 'originalUserEmail';
const IS_IMPERSONATING_KEY = 'isImpersonating';

/**
 * Set impersonation data in session storage
 */
export const setImpersonationData = (adminId: string, adminEmail: string): void => {
  sessionStorage.setItem(ORIGINAL_USER_ID_KEY, adminId);
  sessionStorage.setItem(ORIGINAL_USER_EMAIL_KEY, adminEmail);
  sessionStorage.setItem(IS_IMPERSONATING_KEY, 'true');
};

/**
 * Clear impersonation data from session storage
 */
export const clearImpersonationData = (): void => {
  sessionStorage.removeItem(ORIGINAL_USER_ID_KEY);
  sessionStorage.removeItem(ORIGINAL_USER_EMAIL_KEY);
  sessionStorage.removeItem(IS_IMPERSONATING_KEY);
};

/**
 * Get current impersonation state from session storage
 */
export const getImpersonationData = (): {
  originalUserId: string | null;
  originalUserEmail: string | null;
  isImpersonating: boolean;
} => {
  return {
    originalUserId: sessionStorage.getItem(ORIGINAL_USER_ID_KEY),
    originalUserEmail: sessionStorage.getItem(ORIGINAL_USER_EMAIL_KEY),
    isImpersonating: sessionStorage.getItem(IS_IMPERSONATING_KEY) === 'true'
  };
};
