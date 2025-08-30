import { useState, useEffect } from 'react';
import { WizardState } from '../types';
import { useDealStages } from '@/lib/hooks/useDealStages';
import { initializeDefaultStages } from '@/lib/utils/initializeStages';
import logger from '@/lib/utils/logger';

interface UseDealWizardStateOptions {
  isOpen: boolean;
  actionType: 'deal' | 'proposal' | 'sale' | 'meeting';
  initialData?: {
    clientName?: string;
    contactEmail?: string;
    dealValue?: number;
    oneOffRevenue?: number;
    monthlyMrr?: number;
    saleType?: string;
  };
}

export function useDealWizardState({ isOpen, actionType, initialData }: UseDealWizardStateOptions) {
  const { stages, refetchStages } = useDealStages();
  
  // Debug log stages data
  useEffect(() => {
    logger.log('🎯 DealWizard stages state:', { 
      stages, 
      stagesLength: stages?.length,
      isNull: stages === null,
      isUndefined: stages === undefined,
      isEmpty: stages?.length === 0
    });
    if (stages && stages.length > 0) {
      logger.log('🎯 DealWizard received stages:', stages);
      logger.log('🎯 First stage details:', { 
        id: stages[0]?.id, 
        name: stages[0]?.name,
        hasName: !!stages[0]?.name,
        type: typeof stages[0]?.name 
      });
    }
  }, [stages]);

  // Get default stage for new deals
  const defaultStage = stages?.find(stage => 
    stage?.name?.toLowerCase()?.includes('opportunity') || 
    stage?.name?.toLowerCase()?.includes('lead')
  ) || stages?.[0];

  const [wizard, setWizard] = useState<WizardState>({
    step: 'deal-type',  // Start with deal type selection
    dealType: null,     // Let user select deal type
    selectedContact: null,
    selectedDeal: null,
    dealData: {
      name: initialData?.clientName ? `${initialData.clientName} Opportunity` : '',
      company: initialData?.clientName || '',
      value: initialData?.dealValue || 0,
      description: '',
      stage_id: '', // Start with empty string, will be set when stages load
      expected_close_date: '',
      contact_name: '',
      contact_email: initialData?.contactEmail || '',
      contact_phone: '',
      oneOffRevenue: initialData?.oneOffRevenue || 0,
      monthlyMrr: initialData?.monthlyMrr || 0,
      saleType: initialData?.saleType || 'one-off',
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [hasOpenedContactSearch, setHasOpenedContactSearch] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Automatically open contact search when reaching contact selection step
  useEffect(() => {
    if (isOpen && wizard.step === 'contact-selection' && !wizard.selectedContact && !hasOpenedContactSearch) {
      // Open immediately without delay
      setShowContactSearch(true);
      setHasOpenedContactSearch(true);
      setInitialLoad(false);
    }
    // Reset the flags when modal closes
    if (!isOpen) {
      setHasOpenedContactSearch(false);
      setShowContactSearch(false);
      setInitialLoad(true);
    }
  }, [isOpen, wizard.step, wizard.selectedContact, hasOpenedContactSearch]);

  // Set default stage when stages load
  useEffect(() => {
    // Check if we need to initialize stages
    if (isOpen && (!stages || stages.length === 0)) {
      logger.log('🚨 No stages found, initializing defaults...');
      initializeDefaultStages().then(success => {
        if (success) {
          logger.log('✅ Default stages created, refetching...');
          // Refetch stages instead of reloading page
          if (refetchStages) {
            refetchStages();
          } else {
            logger.error('❌ refetchStages function not available');
          }
        } else {
          logger.error('❌ Failed to initialize default stages');
        }
      }).catch(error => {
        logger.error('❌ Error initializing stages:', error);
      });
    } else if (isOpen && stages && stages.length > 0) {
      // Check if any stages are missing names
      const stagesWithoutNames = stages.filter(s => !s.name);
      if (stagesWithoutNames.length > 0) {
        logger.log('⚠️ Found stages without names, reinitializing...');
        initializeDefaultStages().then(success => {
          if (success) {
            logger.log('✅ Stages reinitialized, refetching...');
            if (refetchStages) {
              refetchStages();
            } else {
              logger.error('❌ refetchStages function not available');
            }
          }
        }).catch(error => {
          logger.error('❌ Error reinitializing stages:', error);
        });
      } else {
        logger.log('✅ Stages are valid, no migration needed');
      }
    }
    
    if (stages && stages.length > 0 && (!wizard.dealData.stage_id || wizard.dealData.stage_id === '')) {
      let selectedStageId;
      
      // For sales, use "Signed" stage
      if (actionType === 'sale') {
        const signedStage = stages.find(s => s.name === 'Signed');
        selectedStageId = signedStage?.id;
        logger.log('🎯 Sale action - Signed stage:', { signedStage, selectedStageId });
      }
      // For meetings, use "SQL" stage
      else if (actionType === 'meeting') {
        const sqlStage = stages.find(s => s.name === 'SQL' || s.name === 'sql');
        selectedStageId = sqlStage?.id;
        logger.log('🎯 Meeting action - SQL stage:', { sqlStage, selectedStageId, stages: stages.map(s => s.name) });
      }
      
      // Fallback to default stage
      if (!selectedStageId) {
        selectedStageId = defaultStage?.id || stages[0]?.id;
        logger.log('⚠️ Using fallback stage:', { defaultStage: defaultStage?.name, selectedStageId });
      }
      
      if (selectedStageId) {
        setWizard(prev => ({
          ...prev,
          dealData: {
            ...prev.dealData,
            stage_id: selectedStageId
          }
        }));
      }
    }
  }, [stages, defaultStage, wizard.dealData.stage_id, isOpen, refetchStages, actionType]);

  // Set the initial stage when the modal opens based on actionType
  useEffect(() => {
    if (isOpen && stages && stages.length > 0) {
      let initialStageId;
      
      // For meetings, immediately set SQL stage
      if (actionType === 'meeting') {
        const sqlStage = stages.find(s => s.name === 'SQL' || s.name === 'sql');
        initialStageId = sqlStage?.id;
        logger.log('🎯 Setting initial SQL stage for meeting:', { sqlStage, initialStageId });
      }
      // For sales, immediately set Signed stage
      else if (actionType === 'sale') {
        const signedStage = stages.find(s => s.name === 'Signed');
        initialStageId = signedStage?.id;
        logger.log('🎯 Setting initial Signed stage for sale:', { signedStage, initialStageId });
      }
      
      // Only update if we found the appropriate stage and it's different from current
      if (initialStageId && wizard.dealData.stage_id !== initialStageId) {
        setWizard(prev => ({
          ...prev,
          dealData: {
            ...prev.dealData,
            stage_id: initialStageId
          }
        }));
      }
    }
  }, [isOpen, actionType, stages]); // Note: not including wizard.dealData.stage_id to avoid infinite loop

  const resetWizard = () => {
    // Reset all state
    setWizard({
      step: 'deal-type',  // Reset to deal type selection step
      dealType: null,     // Reset to no deal type selected
      selectedContact: null,
      selectedDeal: null,
      dealData: {
        name: initialData?.clientName ? `${initialData.clientName} Opportunity` : '',
        company: initialData?.clientName || '',
        value: initialData?.dealValue || 0,
        description: '',
        stage_id: '', // Reset to empty, will be set by useEffect when reopened
        expected_close_date: '',
        contact_name: '',
        contact_email: initialData?.contactEmail || '',
        contact_phone: '',
        oneOffRevenue: initialData?.oneOffRevenue || 0,
        monthlyMrr: initialData?.monthlyMrr || 0,
        saleType: initialData?.saleType || 'one-off',
      }
    });
    setShowContactSearch(false); // Reset contact search state
    setHasOpenedContactSearch(false); // Reset the flag so it opens again next time
    setIsLoading(false); // Reset loading state
  };

  return {
    wizard,
    setWizard,
    stages,
    defaultStage,
    isLoading,
    setIsLoading,
    showContactSearch,
    setShowContactSearch,
    hasOpenedContactSearch,
    initialLoad,
    resetWizard
  };
}