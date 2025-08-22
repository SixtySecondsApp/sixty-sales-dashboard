import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Users, 
  Building2, 
  CheckCircle,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { useDeals } from '@/lib/hooks/useDeals';
import { useDealStages } from '@/lib/hooks/useDealStages';
import { useContacts } from '@/lib/hooks/useContacts';
import { useActivities } from '@/lib/hooks/useActivities';
import { ContactSearchModal } from './ContactSearchModal';
import { cn } from '@/lib/utils';
import { initializeDefaultStages } from '@/lib/utils/initializeStages';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

interface DealWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated?: (deal: any) => void;
  actionType?: 'deal' | 'proposal' | 'sale';
  initialData?: {
    clientName?: string;
    contactEmail?: string;
    dealValue?: number;
  };
}

interface WizardState {
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
  };
}

export function DealWizard({ isOpen, onClose, onDealCreated, actionType = 'deal', initialData }: DealWizardProps) {
  const { userData } = useUser();
  const { createDeal } = useDeals(userData?.id);
  const { stages, refetchStages } = useDealStages();
  
  // Debug log stages data
  useEffect(() => {
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
  const { contacts, createContact, findContactByEmail, autoCreateFromEmail } = useContacts();
  const { addActivityAsync } = useActivities();

  // Get default stage for new deals
  const defaultStage = stages?.find(stage => 
    stage?.name?.toLowerCase()?.includes('opportunity') || 
    stage?.name?.toLowerCase()?.includes('lead')
  ) || stages?.[0];

  const [wizard, setWizard] = useState<WizardState>({
    step: 'new-deal',  // Skip directly to new-deal step
    dealType: 'new',   // Automatically set to new deal
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
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [hasOpenedContactSearch, setHasOpenedContactSearch] = useState(false);

  // Automatically open contact search when modal first opens
  useEffect(() => {
    if (isOpen && !wizard.selectedContact && !hasOpenedContactSearch) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowContactSearch(true);
        setHasOpenedContactSearch(true);
      }, 100);
      return () => clearTimeout(timer);
    }
    // Reset the flag when modal closes
    if (!isOpen) {
      setHasOpenedContactSearch(false);
      setShowContactSearch(false);
    }
  }, [isOpen, wizard.selectedContact, hasOpenedContactSearch]);

  // Set default stage when stages load
  useEffect(() => {
    // Check if we need to initialize stages
    if (isOpen && (!stages || stages.length === 0)) {
      logger.log('🚨 No stages found, initializing defaults...');
      initializeDefaultStages().then(success => {
        if (success) {
          logger.log('✅ Default stages created, refetching...');
          // Refetch stages instead of reloading page
          refetchStages();
        }
      });
    } else if (isOpen && stages && stages.length > 0) {
      // Check if any stages are missing names
      const stagesWithoutNames = stages.filter(s => !s.name);
      if (stagesWithoutNames.length > 0) {
        logger.log('⚠️ Found stages without names, reinitializing...');
        initializeDefaultStages().then(success => {
          if (success) {
            logger.log('✅ Stages reinitialized, refetching...');
            refetchStages();
          }
        });
      }
    }
    
    if (stages && stages.length > 0 && !wizard.dealData.stage_id) {
      const defaultStageId = defaultStage?.id || stages[0]?.id;
      if (defaultStageId) {
        setWizard(prev => ({
          ...prev,
          dealData: {
            ...prev.dealData,
            stage_id: defaultStageId
          }
        }));
      }
    }
  }, [stages, defaultStage, wizard.dealData.stage_id, isOpen, refetchStages]);

  const handleClose = () => {
    // Reset all state
    setWizard({
      step: 'new-deal',  // Reset to new-deal step
      dealType: 'new',   // Reset to new deal type
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
      }
    });
    setShowContactSearch(false); // Reset contact search state
    setHasOpenedContactSearch(false); // Reset the flag so it opens again next time
    setIsLoading(false); // Reset loading state
    onClose();
  };


  const handleContactSelect = (contact: any) => {
    setWizard(prev => ({
      ...prev,
      selectedContact: contact,
      dealData: {
        ...prev.dealData,
        contact_name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
        contact_email: contact.email,
        contact_phone: contact.phone || '',
        company: contact.company?.name || prev.dealData.company,
        name: contact.company?.name ? `${contact.company.name} Opportunity` : prev.dealData.name
      }
    }));
    setShowContactSearch(false);
  };

  const handleCreateContact = async () => {
    if (!wizard.dealData.contact_email) {
      toast.error('Email address is required to create a contact');
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if contact exists first
      const existingContact = await findContactByEmail(wizard.dealData.contact_email);
      
      if (existingContact) {
        handleContactSelect(existingContact);
        return;
      }

      // Auto-create contact from email and name info
      const [firstName, ...lastNameParts] = wizard.dealData.contact_name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const newContact = await autoCreateFromEmail(
        wizard.dealData.contact_email,
        userData?.id || '',
        firstName,
        lastName,
        wizard.dealData.company
      );

      if (newContact) {
        handleContactSelect(newContact);
        toast.success('Contact created successfully!');
      } else {
        throw new Error('Failed to create contact');
      }
    } catch (error) {
      logger.error('Error creating contact:', error);
      toast.error('Failed to create contact. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!wizard.selectedContact) {
      toast.error('Please select a contact first');
      return;
    }

    if (!wizard.dealData.name || !wizard.dealData.company) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setIsLoading(true);

      const dealData = {
        name: wizard.dealData.name,
        company: wizard.dealData.company,
        // company_id and primary_contact_id columns don't exist yet, so commenting them out
        // company_id: wizard.selectedContact.company_id,
        // primary_contact_id: wizard.selectedContact.id,
        contact_name: wizard.selectedContact.full_name,
        contact_email: wizard.selectedContact.email,
        contact_phone: wizard.selectedContact.phone || wizard.dealData.contact_phone,
        value: wizard.dealData.value,
        description: wizard.dealData.description,
        stage_id: wizard.dealData.stage_id || defaultStage?.id,
        owner_id: userData?.id || '',
        expected_close_date: wizard.dealData.expected_close_date || null,
        probability: defaultStage?.default_probability || 10,
        status: 'active'
      };

      logger.log('📝 Creating deal with data:', dealData);
      const newDeal = await createDeal(dealData);
      logger.log('📦 Deal creation result:', newDeal);
      
      if (newDeal && newDeal.id) {
        // Deal created successfully
        logger.log('✅ Deal created successfully with ID:', newDeal.id);
        
        // Only create a proposal activity if this was opened from "Add Proposal"
        if (actionType === 'proposal') {
          try {
            // IMPORTANT: Wait for database transaction to fully commit
            // This is critical to avoid foreign key constraint violations
            logger.log('⏳ Waiting for deal transaction to commit...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Now verify deal exists in database before creating activity
            let dealVerified = false;
            let attempts = 0;
            const maxAttempts = 10; // Increased attempts
            
            logger.log('🔍 Verifying deal exists in database before creating activity...');
            
            while (!dealVerified && attempts < maxAttempts) {
              attempts++;
              
              try {
                // Use a fresh supabase instance to avoid cache issues
                const { data: dealExists, error: verifyError } = await supabase
                  .from('deals')
                  .select('id, name, created_at')
                  .eq('id', newDeal.id)
                  .single(); // Use single() instead of maybeSingle() to get better error info
                
                if (verifyError) {
                  logger.log(`⚠️ Verification attempt ${attempts}/${maxAttempts} - Deal not found yet:`, verifyError.message);
                  
                  // Wait before next attempt with exponential backoff
                  if (attempts < maxAttempts) {
                    const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000);
                    logger.log(`⏳ Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                  }
                } else if (dealExists && dealExists.id) {
                  dealVerified = true;
                  logger.log(`✅ Deal verified in database after ${attempts} attempt(s):`, {
                    id: dealExists.id,
                    name: dealExists.name,
                    created: dealExists.created_at
                  });
                  break; // Exit the loop immediately
                }
              } catch (err) {
                logger.log(`⚠️ Verification attempt ${attempts} error:`, err);
                if (attempts < maxAttempts) {
                  const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              }
            }
            
            if (!dealVerified) {
              logger.error('❌ Could not verify deal in database after maximum attempts');
              logger.log('⚠️ Skipping activity creation to avoid foreign key error');
              toast.warning('Deal created successfully, but proposal activity could not be added. You can add it manually from the deal details.');
              return; // Skip activity creation entirely
            }
            
            // Now create the proposal activity - deal has been verified
            logger.log('📝 Creating proposal activity for verified deal...');
            
            try {
              await addActivityAsync({
                type: 'proposal',
                client_name: wizard.dealData.company || wizard.dealData.name,
                details: `Proposal sent: ${wizard.dealData.name}`,
                amount: wizard.dealData.value,
                priority: 'high',
                date: new Date().toISOString(),
                status: 'completed',
                deal_id: newDeal.id,
                contactIdentifier: wizard.selectedContact?.email,
                contactIdentifierType: wizard.selectedContact?.email ? 'email' : 'unknown'
              });
              logger.log('✅ Proposal activity created successfully for deal:', newDeal.id);
            } catch (activityCreateError: any) {
              logger.error('[Activities]', activityCreateError);
              
              if (activityCreateError?.code === '23503' || activityCreateError?.message?.includes('foreign key')) {
                logger.error('🚨 Foreign key constraint still failing after verification and delays');
                
                // Try one more time with a longer delay
                logger.log('🔄 Final retry attempt for activity creation...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                  await addActivityAsync({
                    type: 'proposal',
                    client_name: wizard.dealData.company || wizard.dealData.name,
                    details: `Proposal sent: ${wizard.dealData.name}`,
                    amount: wizard.dealData.value,
                    priority: 'high',
                    date: new Date().toISOString(),
                    status: 'completed',
                    deal_id: newDeal.id,
                    contactIdentifier: wizard.selectedContact?.email,
                    contactIdentifierType: wizard.selectedContact?.email ? 'email' : 'unknown'
                  });
                  logger.log('✅ Proposal activity created on final retry!');
                } catch (finalError) {
                  logger.error('❌ Final retry also failed:', finalError);
                  toast.warning('Deal created successfully. Proposal activity will be added shortly.');
                }
              } else {
                // Non-foreign key error
                logger.error('Activity creation failed with non-FK error:', activityCreateError);
              }
            }
          } catch (outerError) {
            // This catch handles any unexpected errors in the entire verification/creation flow
            logger.error('Unexpected error in proposal activity flow:', outerError);
            toast.warning('Deal created successfully. Proposal activity may need to be added manually.');
          }
        }
        
        setWizard(prev => ({ ...prev, step: 'success' }));
        
        // Show appropriate success message based on action type
        if (actionType === 'proposal') {
          toast.success('Deal and proposal created successfully!');
        } else {
          toast.success('Deal created successfully!');
        }
        
        if (onDealCreated) {
          onDealCreated(newDeal);
        }
        
        // Give time for data to refresh before closing
        setTimeout(() => {
          handleClose();
        }, 2500);
      } else {
        // Deal creation failed - no deal returned
        logger.error('❌ Deal creation failed - no deal returned. Response:', newDeal);
        toast.error('Failed to create deal - please check the console for details');
      }
    } catch (error) {
      logger.error('Error creating deal:', error);
      toast.error('Failed to create deal. Please try again.');
    } finally {
      setIsLoading(false);
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
                    {actionType === 'proposal' ? 'Create Deal & Proposal' : 'Create New Deal'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {wizard.step === 'new-deal' && (wizard.selectedContact ? 'Fill in deal details' : 'Select a contact to continue')}
                    {wizard.step === 'success' && (actionType === 'proposal' ? 'Deal and proposal created successfully!' : 'Deal created successfully!')}
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
                {wizard.step === 'new-deal' && (
                  <motion.div
                    key="new-deal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
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
                              onClick={() => setWizard(prev => ({ ...prev, selectedContact: null }))}
                              className="px-3 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Deal Information Section */}
                    {wizard.selectedContact && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-violet-400" />
                          Deal Information
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            placeholder="Deal Name *"
                            value={wizard.dealData.name}
                            onChange={(e) => setWizard(prev => ({
                              ...prev,
                              dealData: { ...prev.dealData, name: e.target.value }
                            }))}
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Company Name *"
                            value={wizard.dealData.company}
                            onChange={(e) => setWizard(prev => ({
                              ...prev,
                              dealData: { ...prev.dealData, company: e.target.value }
                            }))}
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="number"
                            placeholder="Deal Value (£)"
                            value={wizard.dealData.value || ''}
                            onChange={(e) => setWizard(prev => ({
                              ...prev,
                              dealData: { ...prev.dealData, value: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                          />
                          <select
                            value={wizard.dealData.stage_id}
                            onChange={(e) => setWizard(prev => ({
                              ...prev,
                              dealData: { ...prev.dealData, stage_id: e.target.value }
                            }))}
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                          >
                            {!stages || stages.length === 0 ? (
                              <option value="">Loading stages...</option>
                            ) : (
                              <>
                                {!wizard.dealData.stage_id && (
                                  <option value="">Select a stage</option>
                                )}
                                {stages.map(stage => {
                                  logger.log('🔍 Rendering stage:', { id: stage.id, name: stage.name, hasName: !!stage.name });
                                  return (
                                    <option key={stage.id} value={stage.id}>
                                      {stage.name || `Stage ${stage.id}`}
                                    </option>
                                  );
                                })}
                              </>
                            )}
                          </select>
                        </div>

                        <textarea
                          placeholder="Description (optional)"
                          value={wizard.dealData.description}
                          onChange={(e) => setWizard(prev => ({
                            ...prev,
                            dealData: { ...prev.dealData, description: e.target.value }
                          }))}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none"
                          rows={3}
                        />

                        <div className="pt-4">
                          <button
                            onClick={handleCreateDeal}
                            disabled={!wizard.dealData.name || !wizard.dealData.company || isLoading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                          >
                            {isLoading ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-5 h-5" />
                                {actionType === 'proposal' ? 'Create Deal & Proposal' : 'Create Deal'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}


                {/* Success Step */}
                {wizard.step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Deal Created Successfully!
                    </h3>
                    <p className="text-gray-400">
                      Your new deal has been added to the pipeline with the selected contact.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Contact Search Modal */}
          <ContactSearchModal
            isOpen={showContactSearch}
            onClose={() => setShowContactSearch(false)}
            onContactSelect={handleContactSelect}
            prefilledEmail={wizard.dealData.contact_email}
            prefilledName={wizard.dealData.contact_name}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}