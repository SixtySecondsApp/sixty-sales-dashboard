import type { Database } from '@/lib/database.types';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

// Support both database profile format and Supabase auth user format
type AuthUser = {
  id: string;
  email?: string;
  is_admin?: boolean;
  role?: string;
  user_metadata?: {
    role?: string;
    [key: string]: any;
  };
};

type UserData = UserProfile | AuthUser | null | undefined;

/**
 * Check if a user has admin privileges
 * Supports both database profile format and Supabase auth user format
 */
export const isUserAdmin = (userData: UserData): boolean => {
  if (!userData) return false;
  
  // Check direct is_admin flag
  if (userData.is_admin === true) return true;
  
  // Check role field in database profile
  if ('role' in userData && userData.role) {
    const role = userData.role.toLowerCase();
    if (role === 'admin' || role === 'super_admin') return true;
  }
  
  // Check user_metadata.role for Supabase auth format
  if ('user_metadata' in userData && userData.user_metadata?.role) {
    const role = userData.user_metadata.role.toLowerCase();
    if (role === 'admin' || role === 'super_admin') return true;
  }
  
  return false;
};

/**
 * Check if a user can split deals
 * Currently only admins can split deals
 */
export const canSplitDeals = (userData: UserData): boolean => {
  return isUserAdmin(userData);
};

/**
 * Check if a user can remove split deals
 * Non-admins cannot remove split deals once they've been created
 */
export const canRemoveSplitDeals = (userData: UserData): boolean => {
  return isUserAdmin(userData);
};

/**
 * Check if a deal has revenue split data
 */
export const isDealSplit = (deal: any): boolean => {
  if (!deal) return false;
  
  const hasOneOff = deal.one_off_revenue && deal.one_off_revenue > 0;
  const hasMonthly = deal.monthly_mrr && deal.monthly_mrr > 0;
  
  // A deal is considered "split" if it has both one-off and monthly revenue
  return hasOneOff && hasMonthly;
};

/**
 * Check if a user can edit a specific deal
 */
export const canEditDeal = (
  deal: any, 
  userData: UserData
): boolean => {
  // Admins can edit any deal
  if (isUserAdmin(userData)) return true;
  
  // Non-admins can edit deals they own, but not if it's a split deal
  if (deal.owner_id === userData?.id) {
    // If it's a split deal, only admins can edit it
    if (isDealSplit(deal)) return false;
    return true;
  }
  
  return false;
};

/**
 * Check if a user can delete a specific deal
 */
export const canDeleteDeal = (
  deal: any, 
  userData: UserData
): boolean => {
  // Admins can delete any deal
  if (isUserAdmin(userData)) return true;
  
  // Non-admins cannot delete split deals
  if (isDealSplit(deal)) return false;
  
  // Non-admins can delete deals they own (if not split)
  return deal.owner_id === userData?.id;
};

/**
 * Check if a user can manage contacts (create, update, delete)
 */
export const canManageContacts = (userData: UserData): boolean => {
  // All authenticated users can manage their own contacts
  // Admins can manage all contacts
  return !!userData?.id;
};

/**
 * Check if a user can manage a specific contact
 */
export const canManageContact = (
  contact: any,
  userData: UserData
): boolean => {
  if (!userData?.id) return false;
  
  // Admins can manage any contact
  if (isUserAdmin(userData)) return true;
  
  // Users can manage contacts they own
  return contact.owner_id === userData.id;
};

/**
 * Check if a user can create contacts for other users (admin feature)
 */
export const canCreateContactsForOthers = (userData: UserData): boolean => {
  return isUserAdmin(userData);
};

/**
 * Get admin override message for permissions
 */
export const getAdminOverrideMessage = (action: string): string => {
  return `${action} requires admin privileges or ownership permissions. Contact your administrator if you believe this is an error.`;
};