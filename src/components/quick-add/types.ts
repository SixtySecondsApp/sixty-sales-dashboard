export type IdentifierType = 'email' | 'phone' | 'linkedin' | 'unknown';

export interface QuickAddFormData {
  type: string;
  client_name: string;
  details: string;
  amount: string;
  oneOffRevenue: string;
  monthlyMrr: string;
  saleType: string;
  outboundCount: string;
  outboundType: string;
  contactIdentifier: string;
  contactIdentifierType: IdentifierType;
  status: string;
  // Task specific fields
  title: string;
  description: string;
  task_type: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  contact_name: string;
  company_website: string;
  // Deal linking
  deal_id: string | null;
  deal_name: string;
  selectedDeal: any;
}

export interface TaskType {
  value: string;
  label: string;
  icon: string;
  color: string;
  iconColor: string;
}

export interface Priority {
  value: string;
  label: string;
  icon: string;
  color: string;
  ringColor: string;
}

export interface QuickAction {
  id: string;
  icon: any;
  label: string;
  color: string;
}

export interface SmartDateOption {
  label: string;
  value: string;
  icon: string;
  description: string;
}

export interface ValidationErrors {
  [key: string]: string;
}