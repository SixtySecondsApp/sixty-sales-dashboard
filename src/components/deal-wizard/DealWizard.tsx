import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle, X } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { ContactSearchModal } from '../ContactSearchModal';
import { cn } from '@/lib/utils';
import { ContactSelectionStep } from './ContactSelectionStep';
import { DealFormStep } from './DealFormStep';
import { SuccessStep } from './SuccessStep';
import { useDealWizardState } from './hooks/useDealWizardState';
import { useContactHandling } from './hooks/useContactHandling';
import { useDealCreation } from './hooks/useDealCreation';
import { DealWizardProps } from './types';

export function DealWizard({ 
  isOpen, 
  onClose, 
  onDealCreated, 
  actionType = 'deal', 
  initialData 
}: DealWizardProps) {
  const { userData } = useUser();
  
  const {
    wizard,
    setWizard,
    stages,
    defaultStage,
    isLoading,
    setIsLoading,
    showContactSearch,
    setShowContactSearch,
    initialLoad,
    resetWizard
  } = useDealWizardState({ isOpen, actionType, initialData });

  const { handleContactSelect } = useContactHandling();
  const { handleCreateDeal } = useDealCreation({ userData, actionType, stages, defaultStage });

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const onContactSelectWrapper = (contact: any) => {
    handleContactSelect(contact, wizard, setWizard);
    setShowContactSearch(false);
  };

  const onCreateDealWrapper = async () => {
    const newDeal = await handleCreateDeal(wizard, setWizard, setIsLoading, onDealCreated);
    
    if (newDeal) {
      // Give time for data to refresh before closing
      setTimeout(() => {
        handleClose();
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {actionType === 'proposal' ? 'Create Deal & Proposal' : 
                     actionType === 'meeting' ? 'Create Meeting & Deal' :
                     'Create New Deal'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {wizard.step === 'new-deal' && (wizard.selectedContact ? 'Fill in deal details' : 'Select a contact to continue')}
                    {wizard.step === 'success' && (
                      actionType === 'proposal' ? 'Deal and proposal created successfully!' : 
                      actionType === 'meeting' ? 'Meeting and deal created successfully!' :
                      'Deal created successfully!'
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Step Progress */}
            <div className="px-6 py-4 border-b border-gray-800/30">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  "bg-violet-500 text-white" // Always active since we start at new-deal
                )}>
                  1
                </div>
                <div className={cn(
                  "flex-1 h-px transition-colors",
                  wizard.step === 'success' ? "bg-violet-500" : "bg-gray-700"
                )} />
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  wizard.step === 'success' ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-300"
                )}>
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Step Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {/* New Deal Flow */}
                {wizard.step === 'new-deal' && !(!wizard.selectedContact && initialLoad) && (
                  <motion.div
                    key="new-deal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <ContactSelectionStep
                      wizard={wizard}
                      showContactSearch={showContactSearch}
                      setShowContactSearch={setShowContactSearch}
                      onContactSelect={onContactSelectWrapper}
                      onWizardChange={setWizard}
                    />

                    {wizard.selectedContact && (
                      <DealFormStep
                        wizard={wizard}
                        actionType={actionType}
                        stages={stages}
                        userData={userData}
                        isLoading={isLoading}
                        onWizardChange={setWizard}
                        onCreateDeal={onCreateDealWrapper}
                      />
                    )}
                  </motion.div>
                )}

                {/* Success Step */}
                {wizard.step === 'success' && (
                  <SuccessStep actionType={actionType} />
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Contact Search Modal */}
          <ContactSearchModal
            isOpen={showContactSearch}
            onClose={() => {
              setShowContactSearch(false);
              // Don't close the entire wizard, just the contact search
            }}
            onContactSelect={onContactSelectWrapper}
            prefilledEmail={wizard.dealData.contact_email}
            prefilledName={wizard.dealData.contact_name}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}