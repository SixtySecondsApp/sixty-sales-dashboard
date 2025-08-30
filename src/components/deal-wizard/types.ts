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
  step: 'new-deal' | 'success';
  dealType: 'new';
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