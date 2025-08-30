import { useState } from 'react';
import type { QuickAddFormData, ValidationErrors } from '../types';

const initialFormData: QuickAddFormData = {
  type: 'outbound',
  client_name: '',
  details: '',
  amount: '',
  oneOffRevenue: '',
  monthlyMrr: '',
  saleType: 'one-off',
  outboundCount: '1',
  outboundType: 'Call',
  contactIdentifier: '',
  contactIdentifierType: 'unknown',
  status: 'completed',
  // Task specific fields
  title: '',
  description: '',
  task_type: 'call',
  priority: 'medium',
  due_date: '',
  contact_name: '',
  company_website: '',
  // Deal linking
  deal_id: null,
  deal_name: '',
  selectedDeal: null,
  // Roadmap specific fields
  roadmap_type: 'feature',
  roadmap_priority: 'medium'
};

export const useFormState = () => {
  const [formData, setFormData] = useState<QuickAddFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData(initialFormData);
    setValidationErrors({});
    setSubmitStatus('idle');
    setIsSubmitting(false);
  };

  const updateFormData = (updates: Partial<QuickAddFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return {
    formData,
    setFormData,
    updateFormData,
    validationErrors,
    setValidationErrors,
    submitStatus,
    setSubmitStatus,
    isSubmitting,
    setIsSubmitting,
    resetForm
  };
};