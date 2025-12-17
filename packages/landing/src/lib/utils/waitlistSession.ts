/**
 * Waitlist Session Management
 * 
 * Stores waitlist entry ID in localStorage when user visits their unique status link.
 * This acts like a "login" so they can access the leaderboard without re-entering email.
 */

const SESSION_KEY = 'waitlist_entry_id';
const SESSION_TIMESTAMP_KEY = 'waitlist_session_timestamp';
const SESSION_DURATION = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds (approx 180 days)

/**
 * Store waitlist entry ID as a session
 */
export function setWaitlistSession(entryId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SESSION_KEY, entryId);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    console.log('[WaitlistSession] Session stored for entry:', entryId);
  } catch (err) {
    console.error('[WaitlistSession] Failed to store session:', err);
  }
}

/**
 * Get stored waitlist entry ID if session is valid
 */
export function getWaitlistSession(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const entryId = localStorage.getItem(SESSION_KEY);
    const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    
    if (!entryId || !timestamp) {
      return null;
    }
    
    // Check if session is still valid (not expired)
    const sessionAge = Date.now() - parseInt(timestamp, 10);
    if (sessionAge > SESSION_DURATION) {
      console.log('[WaitlistSession] Session expired, clearing...');
      clearWaitlistSession();
      return null;
    }
    
    return entryId;
  } catch (err) {
    console.error('[WaitlistSession] Failed to get session:', err);
    return null;
  }
}

/**
 * Clear the waitlist session
 */
export function clearWaitlistSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    console.log('[WaitlistSession] Session cleared');
  } catch (err) {
    console.error('[WaitlistSession] Failed to clear session:', err);
  }
}

/**
 * Check if a valid session exists
 */
export function hasValidWaitlistSession(): boolean {
  return getWaitlistSession() !== null;
}
