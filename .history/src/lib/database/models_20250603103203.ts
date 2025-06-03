/**
 * Database model definitions
 * 
 * This file defines TypeScript interfaces that match our database schema
 * to provide type safety across the application.
 */

/**
 * Company model - NEW CRM ENTITY
 */
export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  website?: string;
  address?: string;
  phone?: string;
  description?: string;
  linkedin_url?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  
  // Computed/joined fields
  contacts?: Contact[];
  deals?: Deal[];
  contactCount?: number;
  dealsValue?: number;
}

/**
 * Enhanced Contact model - UPDATED FOR CRM
 */
export interface Contact {
  id: string;
  company_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string; // Generated column
  email: string;
  phone?: string;
  title?: string; // Job title
  linkedin_url?: string;
  is_primary: boolean;
  owner_id?: string;
  created_at: string;
  updated_at: string;
  
  // Legacy field for backward compatibility
  company?: string;
  
  // Joined relations
  companies?: Company;
  deals?: Deal[];
  deal_contacts?: DealContact[];
  contact_preferences?: ContactPreference;
}

/**
 * Deal Contact relationship - NEW CRM ENTITY
 */
export interface DealContact {
  id: string;
  deal_id: string;
  contact_id: string;
  role: 'decision_maker' | 'influencer' | 'stakeholder' | 'champion' | 'blocker';
  created_at: string;
  
  // Joined relations
  deals?: Deal;
  contacts?: Contact;
}

/**
 * Contact Preferences - NEW CRM ENTITY
 */
export interface ContactPreference {
  id: string;
  contact_id: string;
  preferred_method: 'email' | 'phone' | 'linkedin' | 'text';
  timezone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Activity Sync Rules - NEW CRM ENTITY
 */
export interface ActivitySyncRule {
  id: string;
  activity_type: 'sale' | 'outbound' | 'meeting' | 'proposal';
  min_priority: 'low' | 'medium' | 'high';
  auto_create_deal: boolean;
  target_stage_name?: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Deal Stage model
 */
export interface DealStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  order_position: number;
  default_probability: number;
  created_at: string;
  updated_at: string;
}

/**
 * Enhanced Deal model - UPDATED FOR CRM
 */
export interface Deal {
  id: string;
  name: string;
  company: string; // Legacy field
  contact_name?: string; // Legacy field
  contact_email?: string; // Legacy field
  contact_phone?: string; // Legacy field
  value: number;
  description?: string;
  notes?: string;
  stage_id: string;
  owner_id: string;
  expected_close_date?: string;
  probability?: number;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
  next_steps?: string;
  contact_identifier?: string;
  contact_identifier_type?: string;
  
  // NEW CRM RELATIONSHIPS
  company_id?: string;
  primary_contact_id?: string;
  
  // Joined relations
  companies?: Company;
  contacts?: Contact; // Primary contact
  deal_stages?: DealStage;
  deal_activities?: DealActivity[];
  deal_contacts?: DealContact[]; // All contacts involved
  
  // Computed fields
  daysInStage?: number;
  timeStatus?: 'normal' | 'warning' | 'danger';
}

/**
 * Enhanced Deal Activity model - UPDATED FOR CRM
 */
export interface DealActivity {
  id: string;
  deal_id: string;
  user_id: string;
  activity_type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'stage_change';
  notes?: string;
  due_date?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined relations
  profiles?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

/**
 * Enhanced Activity model - UPDATED FOR CRM
 */
export interface Activity {
  id: string;
  user_id: string;
  type: 'sale' | 'outbound' | 'meeting' | 'proposal';
  status: 'pending' | 'completed' | 'cancelled' | 'no_show';
  priority: 'low' | 'medium' | 'high';
  client_name: string;
  sales_rep: string;
  details?: string;
  amount?: number;
  date: string;
  created_at: string;
  updated_at: string;
  quantity: number;
  contact_identifier?: string;
  contact_identifier_type?: string;
  is_processed?: boolean;
  
  // NEW CRM RELATIONSHIPS
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
  auto_matched?: boolean;
  
  // Joined relations
  companies?: Company;
  contacts?: Contact;
  deals?: Deal;
}

/**
 * Profile model (existing)
 */
export interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  stage?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  is_admin?: boolean;
}

/**
 * Deal Stage History model
 */
export interface DealStageHistory {
  id: string;
  deal_id: string;
  stage_id: string;
  user_id: string;
  entered_at: string;
  exited_at?: string;
  duration_seconds?: number;
}

/**
 * User Profile model
 */
export interface UserProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
} 