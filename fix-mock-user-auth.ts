/*
 * Fix Mock User Authentication for Development
 * 
 * Issue: Mock users in development don't have valid Supabase auth sessions,
 * causing 403 Forbidden errors when trying to access RLS-protected tables.
 * 
 * Solution: Either disable the mock user fallback or ensure proper authentication.
 */

// Option 1: Disable mock user fallback (Recommended for production-like testing)
export const DISABLE_MOCK_USERS = true;

// Option 2: If you need mock users, they should match existing profiles in the database
export const DEV_USER_PROFILES = {
  ANDREW: {
    id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', 
    email: 'andrew.bryce@sixtyseconds.video',
    first_name: 'Andrew',
    last_name: 'Bryce',
    is_admin: true
  }
};

// Function to create a proper authenticated session for development
export const createDevSession = async (userId: string) => {
  // This would need to be implemented with proper Supabase auth
  // For now, recommend using actual authentication instead of mock users
  console.warn('Mock users should be replaced with proper authentication for RLS compatibility');
};