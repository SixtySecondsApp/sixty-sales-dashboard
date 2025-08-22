import React, { useState, useEffect } from 'react';
import { Activity } from '@/lib/hooks/useActivities'; // Assuming Activity type path
import { IdentifierType } from './IdentifierField'; // Assuming IdentifierType path
import { Button } from '@/components/ui/button';
import logger from '@/lib/utils/logger';
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
type EditFormData = Omit<Partial<Activity>, 'id' | 'user_id'>;

export function EditActivityForm({ activity, onSave, onCancel }: EditActivityFormProps) {
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
    sales_rep: activity.sales_rep
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
        sales_rep: activity.sales_rep
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

  // Handle the save action
  const handleSaveChanges = async () => {
    // Construct the updates object from the current form state
    const updates: Partial<Activity> = { ...formData };

    // Conditionally manage contact identifier fields based on type
    if (formData.type !== 'outbound') {
      updates.contactIdentifier = formData.contactIdentifier;
      updates.contactIdentifierType = formData.contactIdentifierType as IdentifierType; // Ensure type casting if needed
    } else {
      updates.contactIdentifier = undefined;
      updates.contactIdentifierType = undefined;
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

    // Call the onSave prop (which wraps the API call and handles success/error)
    await onSave(activity.id, updates);
    // onSave should handle closing the dialog on success
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Activity</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
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
        {/* Status Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Status</label>
          
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'completed', label: 'Completed', icon: '✅', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
              { value: 'pending', label: 'Scheduled', icon: '📅', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
              { value: 'cancelled', label: 'Cancelled', icon: '❌', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
              { value: 'no_show', label: 'No Show', icon: '🚫', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
            ].map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setFormData(prevData => ({ ...prevData, status: status.value as 'completed' | 'pending' | 'cancelled' | 'no_show' }))}
                className={`p-3 rounded-xl border transition-all ${
                  formData.status === status.value
                    ? `${status.color} ring-2 ring-opacity-50`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{status.icon}</span>
                  <span className="text-sm font-medium">{status.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Contact Identifier Inputs (Conditional) */}
        {formData.type !== 'outbound' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Contact Identifier</label>
              <input
                type="text"
                placeholder="Enter email or phone"
                name="contactIdentifier"
                value={formData.contactIdentifier || ''}
                onChange={handleFormChange}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent mb-2"
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
          </>
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