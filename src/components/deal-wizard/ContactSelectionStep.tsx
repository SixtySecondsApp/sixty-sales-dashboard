import React from 'react';
import { Users } from 'lucide-react';
import { ContactSelectionStepProps } from './types';

export function ContactSelectionStep({ 
  wizard, 
  showContactSearch, 
  setShowContactSearch, 
  onContactSelect,
  onWizardChange 
}: ContactSelectionStepProps) {
  const handleContactChange = () => {
    onWizardChange({
      ...wizard,
      selectedContact: null
    });
  };

  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Select Contact</h3>
        <p className="text-sm text-gray-400">Choose an existing contact or create a new one</p>
      </div>

      {/* Contact Selection Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Contact Information
          </h4>
          {wizard.selectedContact && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
              Contact Selected
            </span>
          )}
        </div>

        {!wizard.selectedContact ? (
          <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
            <button
              onClick={() => setShowContactSearch(true)}
              className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              Search Contacts
            </button>
          </div>
        ) : (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-emerald-400">{wizard.selectedContact.full_name}</h5>
                <p className="text-sm text-emerald-300/70">{wizard.selectedContact.email}</p>
                {wizard.selectedContact.company && (
                  <p className="text-sm text-gray-400">{wizard.selectedContact.company.name}</p>
                )}
              </div>
              <button
                onClick={handleContactChange}
                className="px-3 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}