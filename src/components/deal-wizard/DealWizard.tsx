import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle, X } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { ContactSearchModal } from '../ContactSearchModal';
import { cn } from '@/lib/utils';
import { DealTypeStep } from './DealTypeStep';
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

  const handleNextStep = () => {
    if (wizard.step === 'deal-type') {
      setWizard({ ...wizard, step: 'contact-selection' });
    } else if (wizard.step === 'contact-selection') {
      setWizard({ ...wizard, step: 'deal-form' });
    }
  };

  const onContactSelectWrapper = (contact: any) => {
    handleContactSelect(contact, wizard, setWizard);
    setShowContactSearch(false);
    // Auto advance to deal form step
    setWizard(prev => ({ ...prev, step: 'deal-form' }));
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
          className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="
              fixed inset-0 w-full h-full max-w-none max-h-none rounded-none
              sm:relative sm:inset-auto sm:w-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-2xl
              theme-bg-card backdrop-blur-sm theme-border overflow-y-auto shadow-lg
              flex flex-col
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b theme-border flex-shrink-0 sticky top-0 z-10 theme-bg-card backdrop-blur-sm">
              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="p-2 bg-violet-500/10 rounded-lg flex-shrink-0">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-xl font-semibold theme-text-primary leading-tight">
                    {actionType === 'proposal' ? 'Create Deal & Proposal' :
                     actionType === 'meeting' ? 'Create Meeting & Deal' :
                     'Create New Deal'}
                  </h2>
                  <p className="text-xs sm:text-sm theme-text-tertiary mt-0.5 line-clamp-2">
                    {wizard.step === 'deal-type' && 'Choose the type of deal you\'re creating'}
                    {wizard.step === 'contact-selection' && 'Select a contact to continue'}
                    {wizard.step === 'deal-form' && 'Fill in deal details'}
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors flex-shrink-0 min-h-[40px] min-w-[40px]"
              >
                <X className="w-5 h-5 theme-text-tertiary" />
              </button>
            </div>

            {/* Step Progress */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b theme-border flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Step 1: Deal Type */}
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors",
                  wizard.step === 'deal-type' ? "bg-violet-500 text-white" :
                  wizard.dealType ? "bg-emerald-500 text-white" : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}>
                  1
                </div>
                <div className={cn(
                  "flex-1 h-px transition-colors",
                  wizard.dealType ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-700"
                )} />

                {/* Step 2: Contact & Deal Form */}
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors",
                  wizard.step === 'contact-selection' || wizard.step === 'deal-form' ? "bg-violet-500 text-white" :
                  wizard.step === 'success' ? "bg-emerald-500 text-white" : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}>
                  2
                </div>
                <div className={cn(
                  "flex-1 h-px transition-colors",
                  wizard.step === 'success' ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-700"
                )} />

                {/* Step 3: Success */}
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors",
                  wizard.step === 'success' ? "bg-emerald-500 text-white" : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}>
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6">
              <AnimatePresence mode="wait">
                {/* Step 1: Deal Type Selection */}
                {wizard.step === 'deal-type' && (
                  <motion.div
                    key="deal-type"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <DealTypeStep
                      wizard={wizard}
                      onWizardChange={setWizard}
                      onNext={handleNextStep}
                    />
                  </motion.div>
                )}

                {/* Step 2: Contact Selection */}
                {wizard.step === 'contact-selection' && (
                  <motion.div
                    key="contact-selection"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <ContactSelectionStep
                      wizard={wizard}
                      showContactSearch={showContactSearch}
                      setShowContactSearch={setShowContactSearch}
                      onContactSelect={onContactSelectWrapper}
                      onWizardChange={setWizard}
                    />
                  </motion.div>
                )}

                {/* Step 3: Deal Form */}
                {wizard.step === 'deal-form' && (
                  <motion.div
                    key="deal-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <DealFormStep
                      wizard={wizard}
                      actionType={actionType}
                      stages={stages}
                      userData={userData}
                      isLoading={isLoading}
                      onWizardChange={setWizard}
                      onCreateDeal={onCreateDealWrapper}
                    />
                  </motion.div>
                )}

                {/* Step 4: Success */}
                {wizard.step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <SuccessStep actionType={actionType} />
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
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