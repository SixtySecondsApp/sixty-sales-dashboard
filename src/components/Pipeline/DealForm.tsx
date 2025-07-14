import React, { useState, useEffect } from 'react';
import { X, Calendar, PoundSterling, Users, Building, FileText } from 'lucide-react';
import { useDealStages } from '@/lib/hooks/useDealStages';
import { IdentifierField, IdentifierType } from '@/components/IdentifierField';
import { toast } from 'sonner';

interface DealFormProps {
  deal?: any;
  onSave: (formData: any) => void;
  onCancel: () => void;
  initialStageId?: string | null;
}

interface FormData {
  name: string;
  company: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  value: string | number;
  one_off_revenue?: string | number;
  monthly_mrr?: string | number;
  stage_id: string;
  expected_close_date: string;
  description: string;
  probability: string | number;
  contactIdentifier: string;
  contactIdentifierType: IdentifierType;
}

export function DealForm({ 
  deal = null, 
  onSave, 
  onCancel, 
  initialStageId = null 
}: DealFormProps) {
  const { stages } = useDealStages();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    company: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    value: '',
    stage_id: '',
    expected_close_date: '',
    description: '',
    probability: '',
    contactIdentifier: '',
    contactIdentifierType: 'unknown'
  });
  
  // Initialize form with deal data if editing
  useEffect(() => {
    if (deal) {
      setFormData({
        name: deal.name || '',
        company: deal.company || '',
        contact_name: deal.contact_name || '',
        contact_email: deal.contact_email || '',
        contact_phone: deal.contact_phone || '',
        value: deal.value || '',
        stage_id: deal.stage_id || '',
        expected_close_date: deal.expected_close_date || '',
        description: deal.description || '',
        probability: deal.probability || '',
        contactIdentifier: deal.contact_identifier || deal.contactIdentifier || '',
        contactIdentifierType: deal.contact_identifier_type || deal.contactIdentifierType || 'unknown'
      });
    } else if (initialStageId) {
      setFormData(prev => ({
        ...prev,
        stage_id: initialStageId
      }));
    }
  }, [deal, initialStageId]);
  
  // Set default probability based on selected stage
  useEffect(() => {
    if (formData.stage_id && !formData.probability) {
      const selectedStage = stages?.find(s => s.id === formData.stage_id);
      if (selectedStage) {
        setFormData(prev => ({
          ...prev,
          probability: selectedStage.default_probability
        }));
      }
    }
  }, [formData.stage_id, stages, formData.probability]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if contact identifier is provided
    if (!formData.contactIdentifier) {
      toast.error('Please provide a contact identifier (email, phone number, or LinkedIn URL)');
      return;
    }
    
    // Validate the contact identifier if it's provided
    if (formData.contactIdentifierType === 'unknown') {
      toast.error('Please enter a valid email, phone number, or LinkedIn URL');
      return;
    }
    
    // Prepare data for saving, mapping camelCase to snake_case and ensuring empty date is null
    const { contactIdentifier, contactIdentifierType, ...otherFormData } = formData;
    
    const dataToSave = {
      ...otherFormData,
      expected_close_date: formData.expected_close_date === '' ? null : formData.expected_close_date,
      // Map camelCase frontend fields to snake_case database fields
      contact_identifier: contactIdentifier,
      contact_identifier_type: contactIdentifierType
    };
    
    onSave(dataToSave); // Pass the cleaned data
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">
          {deal ? 'Edit Deal' : 'New Deal'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Deal name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Deal Name
          </label>
          <div className="flex items-center border border-gray-700 rounded-lg
            bg-gray-900/80 focus-within:border-violet-500/50 transition-colors"
          >
            <span className="pl-3 text-gray-500">
              <FileText className="w-5 h-5" />
            </span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter deal name"
              className="w-full p-2.5 bg-transparent border-none
                outline-none text-white"
            />
          </div>
        </div>
        
        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Company
          </label>
          <div className="flex items-center border border-gray-700 rounded-lg
            bg-gray-900/80 focus-within:border-violet-500/50 transition-colors"
          >
            <span className="pl-3 text-gray-500">
              <Building className="w-5 h-5" />
            </span>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              required
              placeholder="Enter company name"
              className="w-full p-2.5 bg-transparent border-none
                outline-none text-white"
            />
          </div>
        </div>
        
        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Contact Name
          </label>
          <div className="flex items-center border border-gray-700 rounded-lg
            bg-gray-900/80 focus-within:border-violet-500/50 transition-colors"
          >
            <span className="pl-3 text-gray-500">
              <Users className="w-5 h-5" />
            </span>
            <input
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              placeholder="Enter contact name"
              className="w-full p-2.5 bg-transparent border-none
                outline-none text-white"
            />
          </div>
        </div>
        
        {/* Contact Identifier Field with improved styling */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center">
            Email Address
            <span className="text-red-500 ml-1">*</span>
          </label>
          <IdentifierField
            value={formData.contactIdentifier}
            onChange={(value, type) => 
              setFormData({
                ...formData, 
                contactIdentifier: value, 
                contactIdentifierType: type
              })
            }
            required={true}
            placeholder="Required: Enter email address"
            label=""
          />
        </div>
        
        {/* Revenue Model */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-300">Deal Revenue</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                One-off Revenue (£)
              </label>
              <div className="flex items-center border border-gray-700 rounded-lg
                bg-gray-900/80 focus-within:border-violet-500/50 transition-colors"
              >
                <span className="pl-3 text-gray-500">
                  <PoundSterling className="w-5 h-5" />
                </span>
                <input
                  type="number"
                  name="one_off_revenue"
                  value={formData.one_off_revenue || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full p-2.5 bg-transparent border-none
                    outline-none text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Monthly Recurring Revenue (£)
              </label>
              <div className="flex items-center border border-gray-700 rounded-lg
                bg-gray-900/80 focus-within:border-violet-500/50 transition-colors"
              >
                <span className="pl-3 text-gray-500">
                  <PoundSterling className="w-5 h-5" />
                </span>
                <input
                  type="number"
                  name="monthly_mrr"
                  value={formData.monthly_mrr || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full p-2.5 bg-transparent border-none
                    outline-none text-white"
                />
              </div>
            </div>
          </div>
          
          {/* Total Deal Value Display */}
          {(formData.one_off_revenue || formData.monthly_mrr) && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="text-sm text-emerald-400">
                <span className="font-medium">Total Deal Value: </span>
                £{(
                  (parseFloat(formData.one_off_revenue as string) || 0) + 
                  ((parseFloat(formData.monthly_mrr as string) || 0) * 3)
                ).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              {formData.monthly_mrr && parseFloat(formData.monthly_mrr as string) > 0 && (
                <div className="text-xs text-gray-400 mt-1">
                  Annual Value: £{(
                    (parseFloat(formData.one_off_revenue as string) || 0) + 
                    ((parseFloat(formData.monthly_mrr as string) || 0) * 12)
                  ).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Pipeline Stage */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Pipeline Stage
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {stages && stages.map(stage => (
              <button
                key={stage.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, stage_id: stage.id }))}
                className={`p-3 rounded-xl border transition-all ${
                  formData.stage_id === stage.id
                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 ring-2 ring-violet-500/30'
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stage.color || '#6366f1' }}
                  />
                  <span className="text-sm font-medium">{stage.name}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {stage.default_probability}% probability
                </div>
              </button>
            ))}
          </div>
          
          {!formData.stage_id && (
            <p className="text-red-400 text-sm mt-1">Please select a pipeline stage</p>
          )}
        </div>
        
        {/* Close Date and Probability side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Expected Close Date
            </label>
            <div className="flex items-center border border-gray-700 rounded-lg
              bg-gray-900/80 focus-within:border-violet-500/50 transition-colors"
            >
              <span className="pl-3 text-gray-500">
                <Calendar className="w-5 h-5" />
              </span>
              <input
                type="date"
                name="expected_close_date"
                value={formData.expected_close_date}
                onChange={handleChange}
                className="w-full p-2.5 bg-transparent border-none
                  outline-none text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Win Probability (%)
            </label>
            <input
              type="number"
              name="probability"
              value={formData.probability}
              onChange={handleChange}
              min="0"
              max="100"
              step="1"
              placeholder="Enter probability"
              className="w-full p-2.5 bg-gray-900/80 border border-gray-700
                rounded-lg text-white outline-none focus:border-violet-500/50
                transition-colors"
            />
            
            {/* Probability slider */}
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.probability || 0}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                probability: e.target.value
              }))}
              className="w-full mt-2 bg-gray-700 rounded-lg appearance-none h-2 outline-none"
            />
          </div>
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            placeholder="Enter deal description"
            className="w-full p-2.5 bg-gray-900/80 border border-gray-700
              rounded-lg text-white outline-none focus:border-violet-500/50
              transition-colors resize-none"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg
            hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg
            border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
        >
          {deal ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  );
} 