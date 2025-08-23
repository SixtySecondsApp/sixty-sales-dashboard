import type { Database } from '@/lib/database.types';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

/**
 * Check if a user has admin privileges
 */
export const isUserAdmin = (userData: UserProfile | null | undefined): boolean => {
  return userData?.is_admin || false;
};

/**
 * Check if a user can split deals
 * Currently only admins can split deals
 */
export const canSplitDeals = (userData: UserProfile | null | undefined): boolean => {
  return isUserAdmin(userData);
};

/**
 * Check if a user can remove split deals
 * Non-admins cannot remove split deals once they've been created
 */
export const canRemoveSplitDeals = (userData: UserProfile | null | undefined): boolean => {
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
  userData: UserProfile | null | undefined
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
  userData: UserProfile | null | undefined
): boolean => {
  // Admins can delete any deal
  if (isUserAdmin(userData)) return true;
  
  // Non-admins cannot delete split deals
  if (isDealSplit(deal)) return false;
  
  // Non-admins can delete deals they own (if not split)
  return deal.owner_id === userData?.id;
};