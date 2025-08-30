export interface DealWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated?: (deal: any) => void;
  actionType?: 'deal' | 'proposal' | 'sale' | 'meeting';
  initialData?: {
    clientName?: string;
    contactEmail?: string;
    dealValue?: number;
    oneOffRevenue?: number;
    monthlyMrr?: number;
    saleType?: string;
  };
}

export interface WizardState {
  step: 'deal-type' | 'contact-selection' | 'deal-form' | 'success';
  dealType: DealType | null;
  selectedContact: any | null;
  selectedDeal: any | null;
  dealData: {
    name: string;
    company: string;
    value: number;
    description: string;
    stage_id: string;
    expected_close_date: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    oneOffRevenue: number;
    monthlyMrr: number;
    saleType: string;
  };
}

export type DealType = 
  | 'subscription'    // Monthly recurring revenue
  | 'one-off'        // Single payment
  | 'project'        // Fixed scope project
  | 'retainer'       // Ongoing monthly service
  | 'custom';        // Custom deal structure

export interface DealTypeConfig {
  id: DealType;
  title: string;
  description: string;
  icon: string;
  fields: {
    value?: boolean;
    oneOffRevenue?: boolean;
    monthlyMrr?: boolean;
    projectScope?: boolean;
    duration?: boolean;
    milestones?: boolean;
    retainerDetails?: boolean;
  };
  defaultSaleType?: string;
}

export interface DealTypeStepProps {
  wizard: WizardState;
  onWizardChange: (wizard: WizardState) => void;
  onNext: () => void;
}

export interface ContactSelectionStepProps {
  wizard: WizardState;
  showContactSearch: boolean;
  setShowContactSearch: (show: boolean) => void;
  onContactSelect: (contact: any) => void;
  onWizardChange: (wizard: WizardState) => void;
}

export interface DealFormStepProps {
  wizard: WizardState;
  actionType: 'deal' | 'proposal' | 'sale' | 'meeting';
  stages: any[] | null;
  userData: any;
  isLoading: boolean;
  onWizardChange: (wizard: WizardState) => void;
  onCreateDeal: () => Promise<void>;
}

export interface SuccessStepProps {
  actionType: 'deal' | 'proposal' | 'sale' | 'meeting';
}