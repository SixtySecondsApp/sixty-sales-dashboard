import React, { useState, useEffect } from 'react';
import { Activity } from '@/lib/hooks/useActivities'; // Assuming Activity type path
import { IdentifierType } from './IdentifierField'; // Assuming IdentifierType path
import { Button } from '@/components/ui/button';
import logger from '@/lib/utils/logger';
import { useDeals } from '@/lib/hooks/useDeals';
import { supabase } from '@/lib/supabase/clientV2';
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// Define props for the form component
interface EditActivityFormProps {
  activity: Activity; // The original activity data
  onSave: (activityId: string, updates: Partial<Activity>) => Promise<void>; // Callback to handle saving
  onCancel: () => void; // Callback to handle cancellation/closing
}

// Define the type for the form data state
type EditFormData = Omit<Partial<Activity>, 'id' | 'user_id'> & {
  // Revenue fields for sales
  monthlyMrr?: number;
  oneOffRevenue?: number;
  // Company information
  company_website?: string;
  // Proposal specific
  proposalValue?: number;
};

export function EditActivityForm({ activity, onSave, onCancel }: EditActivityFormProps) {
  const { updateDeal } = useDeals();
  // State to manage the form data, initialized with the activity data
  const [formData, setFormData] = useState<EditFormData>({
    client_name: activity.client_name,
    details: activity.details,
    amount: activity.amount,
    status: activity.status,
    contactIdentifier: activity.contactIdentifier,
    contactIdentifierType: activity.contactIdentifierType,
    type: activity.type,
    date: activity.date,
    priority: activity.priority,
    quantity: activity.quantity,
    sales_rep: activity.sales_rep,
    // Initialize revenue fields from linked deal
    monthlyMrr: activity.deals?.monthly_mrr || 0,
    oneOffRevenue: activity.deals?.one_off_revenue || 0,
    // Company website - we'll need to fetch this or initialize empty
    company_website: '',
    // Proposal value - use amount for proposals
    proposalValue: activity.type === 'proposal' ? activity.amount : 0
  });

  // Update form data if the activity prop changes (e.g., opening dialog for different activity)
  useEffect(() => {
    setFormData({
        client_name: activity.client_name,
        details: activity.details,
        amount: activity.amount,
        status: activity.status,
        contactIdentifier: activity.contactIdentifier,
        contactIdentifierType: activity.contactIdentifierType,
        type: activity.type,
        date: activity.date,
        priority: activity.priority,
        quantity: activity.quantity,
        sales_rep: activity.sales_rep,
        // Initialize revenue fields from linked deal
        monthlyMrr: activity.deals?.monthly_mrr || 0,
        oneOffRevenue: activity.deals?.one_off_revenue || 0,
        // Company website - we'll need to fetch this or initialize empty
        company_website: '',
        // Proposal value - use amount for proposals
        proposalValue: activity.type === 'proposal' ? activity.amount : 0
    });
  }, [activity]);


  // Handle changes in general form inputs
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle changes specifically for the amount input
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);
    const newAmount = value === '' || isNaN(parsedValue) ? undefined : parsedValue;
    setFormData(prevData => ({
      ...prevData,
      [name]: newAmount,
    }));
  };

  // Handle changes specifically for revenue fields (monthlyMrr, oneOffRevenue, proposalValue)
  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);
    const newValue = value === '' || isNaN(parsedValue) ? 0 : parsedValue;
    setFormData(prevData => ({
      ...prevData,
      [name]: newValue,
    }));
  };

  // Handle the save action
  const handleSaveChanges = async () => {
    // Construct the updates object from the current form state
    const updates: Partial<Activity> = { 
      client_name: formData.client_name,
      details: formData.details,
      status: formData.status,
      priority: formData.priority,
      quantity: formData.quantity,
      date: formData.date
    };

    // Conditionally manage contact identifier fields based on type
    if (formData.type !== 'outbound') {
      updates.contactIdentifier = formData.contactIdentifier;
      updates.contactIdentifierType = formData.contactIdentifierType as IdentifierType; // Ensure type casting if needed
    } else {
      updates.contactIdentifier = undefined;
      updates.contactIdentifierType = undefined;
    }
    
    // Handle activity-specific amounts and calculations
    if (formData.type === 'sale') {
      // For sales, calculate LTV and set amount
      const oneOff = formData.oneOffRevenue || 0;
      const monthly = formData.monthlyMrr || 0;
      const ltv = (monthly * 3) + oneOff; // LTV calculation
      updates.amount = ltv;
      
      // Note: Deal revenue fields (monthly_mrr, one_off_revenue) will be updated separately
      // through the linked deal record via activity.deal_id
    } else if (formData.type === 'proposal') {
      // For proposals, use proposal value
      updates.amount = formData.proposalValue;
    } else {
      // For other types, keep existing amount or use form amount
      updates.amount = formData.amount;
    }
    
    // Remove amount field if undefined before saving
    if (updates.amount === undefined) {
      delete updates.amount;
    }

    // Basic validation
    if (!updates.client_name || !updates.details || !updates.status) {
      // Consider using a local error state instead of toast here if needed
      // toast.error("Client Name, Details, and Status are required."); 
      logger.error("Validation failed: Client Name, Details, Status required.");
      return; 
    }

    // Update linked deal with revenue fields if this is a sale with deal_id
    if (formData.type === 'sale' && activity.deal_id) {
      try {
        const dealUpdates = {
          monthly_mrr: formData.monthlyMrr || null,
          one_off_revenue: formData.oneOffRevenue || null,
          value: updates.amount, // Update deal value to match LTV
          company: formData.client_name, // Update company name
          // Add company website if we have it in the deal structure
        };
        
        logger.log('Updating linked deal:', activity.deal_id, dealUpdates);
        await updateDeal(activity.deal_id, dealUpdates);
      } catch (error) {
        logger.error('Failed to update linked deal:', error);
        // Don't fail the entire operation if deal update fails
      }
    }
    
    // Call the onSave prop (which wraps the API call and handles success/error)
    await onSave(activity.id, updates);
    // onSave should handle closing the dialog on success
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Activity</DialogTitle>
      </DialogHeader>
      <div className="space-y-6 py-4">
        {/* Top Row: Basic Fields in horizontal grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Client Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Client Name</label>
            <input
              type="text"
              name="client_name"
              value={formData.client_name || ''}
              onChange={handleFormChange}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
            />
          </div>
          {/* Details Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Details</label>
            <input
              type="text"
              name="details"
              value={formData.details || ''}
              onChange={handleFormChange}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
            />
          </div>
          {/* Amount Input (Conditional) */}
          {formData.amount !== undefined && formData.amount !== null && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Amount</label>
              <input
                type="text" 
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                step="0.01"
                name="amount"
                value={formData.amount ?? ''}
                onChange={handleAmountChange}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
              />
            </div>
          )}
          {/* Company Website Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Company Website</label>
            <input
              type="url"
              placeholder="https://company.com"
              name="company_website"
              value={formData.company_website || ''}
              onChange={handleFormChange}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
            />
          </div>
        </div>
        {/* Status Select - Horizontal layout */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Status</label>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {[
              { value: 'completed', label: 'Completed', icon: '✅', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
              { value: 'pending', label: 'Scheduled', icon: '📅', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
              { value: 'cancelled', label: 'Cancelled', icon: '❌', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
              { value: 'no_show', label: 'No Show', icon: '🚫', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
              ...(formData.type === 'meeting' ? [
                { value: 'discovery', label: 'Discovery', icon: '🔍', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
              ] : [])
            ].map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setFormData(prevData => ({ ...prevData, status: status.value as 'completed' | 'pending' | 'cancelled' | 'no_show' | 'discovery' }))}
                className={`p-2 rounded-xl border transition-all ${
                  formData.status === status.value
                    ? `${status.color} ring-2 ring-opacity-50`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-sm">{status.icon}</span>
                  <span className="text-xs font-medium">{status.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Activity Type-Specific Fields */}
        {formData.type === 'sale' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">Revenue Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Monthly MRR</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    name="monthlyMrr"
                    value={formData.monthlyMrr || ''}
                    onChange={handleRevenueChange}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-8 pr-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">One-Off Revenue</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    name="oneOffRevenue"
                    value={formData.oneOffRevenue || ''}
                    onChange={handleRevenueChange}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-8 pr-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            {/* LTV Display */}
            {(formData.monthlyMrr || formData.oneOffRevenue) && (
              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3">
                <div className="text-sm text-gray-400 mb-1">Calculated LTV</div>
                <div className="text-lg font-semibold text-[#37bd7e]">
                  £{((formData.monthlyMrr || 0) * 3 + (formData.oneOffRevenue || 0)).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}

        {formData.type === 'proposal' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Proposal Value</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 text-sm">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                name="proposalValue"
                value={formData.proposalValue || ''}
                onChange={handleRevenueChange}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-8 pr-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Contact Identifier Inputs - Horizontal (Conditional) */}
        {formData.type !== 'outbound' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Contact Identifier</label>
              <input
                type="text"
                placeholder="Enter email or phone"
                name="contactIdentifier"
                value={formData.contactIdentifier || ''}
                onChange={handleFormChange}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Identifier Type</label>
              <input
                type="text"
                placeholder="Identifier Type (e.g., email, phone)"
                name="contactIdentifierType"
                value={formData.contactIdentifierType || ''}
                onChange={handleFormChange}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button 
          variant="outline" 
          onClick={onCancel} // Use onCancel prop
          // Change text to black, remove hover text change for simplicity
          className="text-black border-gray-600 hover:bg-gray-700" 
        >
          Cancel 
        </Button>
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </DialogFooter>
    </>
  );
} 