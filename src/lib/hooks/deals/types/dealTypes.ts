// Core deal and stage types for the deals hook system
export interface DealWithRelationships {
  id: string;
  name: string;
  company: string;
  contact_name: string;
  value: number;
  status: string;
  stage_id: string;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
  probability: number;
  close_date: string;
  notes: string;
  owner_id: string;
  company_id?: string;
  primary_contact_id?: string;
  contact_email?: string;
  
  // Revenue model fields
  one_off_revenue?: number;
  monthly_mrr?: number;
  annual_value?: number;
  
  // Computed fields
  daysInStage: number;
  timeStatus: 'normal' | 'warning' | 'danger';
  
  // Joined relationship data from Neon (CRM)
  deal_stages?: {
    id: string;
    name: string;
    color: string;
    default_probability: number;
  };
  companies?: {
    id: string;
    name: string;
    domain: string;
    size: string;
    industry: string;
    website: string;
    linkedin_url: string;
  };
  contacts?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
    title: string;
    linkedin_url: string;
    is_primary: boolean;
  };
  deal_contacts?: Array<{
    contact_id: string;
    contact: {
      id: string;
      full_name: string;
      email: string;
      title: string;
    };
  }>;
}

export interface DealStage {
  id: string;
  name: string;
  color: string;
  order_position: number;
  default_probability: number;
}

export interface DealsByStage {
  [stageId: string]: DealWithRelationships[];
}

export interface DealCreateData {
  name: string;
  company: string;
  contact_name?: string;
  value: number;
  stage_id: string;
  probability?: number;
  notes?: string;
  owner_id: string;
  one_off_revenue?: number;
  monthly_mrr?: number;
  expected_close_date?: string;
  [key: string]: any;
}

export interface DealUpdateData {
  name?: string;
  company?: string;
  contact_name?: string;
  value?: number;
  stage_id?: string;
  probability?: number;
  notes?: string;
  description?: string;
  expected_close_date?: string | null;
  one_off_revenue?: number;
  monthly_mrr?: number;
  updated_at?: string;
  stage_changed_at?: string;
  [key: string]: any;
}

export interface DealForStageTransition {
  id: string;
  name: string;
  company: string;
  value: number;
  owner_id: string;
  contact_email?: string;
}