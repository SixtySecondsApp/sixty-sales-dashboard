import { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format, addDays, addWeeks } from 'date-fns';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

// Original imports for backward compatibility
import { useActivities } from '@/lib/hooks/useActivities';
import { useTasks } from '@/lib/hooks/useTasks';
import { useContacts } from '@/lib/hooks/useContacts';
import { useUser } from '@/lib/hooks/useUser';
import { useDeals } from '@/lib/hooks/useDeals';
import { useRoadmap } from '@/lib/hooks/useRoadmap';
import { ContactSearchModal } from '@/components/ContactSearchModal';
import logger from '@/lib/utils/logger';
import { supabase, authUtils } from '@/lib/supabase/clientV2';

// New decoupling imports
import { 
  useEventListener, 
  useEventEmitter,
  eventBus 
} from '@/lib/communication/EventBus';
import {
  BaseComponent,
  IFormComponent
} from '@/lib/communication/ComponentInterfaces';
import {
  getServiceAdapter,
  ActivityServiceAdapter,
  TaskServiceAdapter,
  NotificationServiceAdapter
} from '@/lib/communication/ServiceAdapters';
import {
  useFormState as useDecoupledFormState,
  useModalState,
  useComponentState,
  useBusinessState
} from '@/lib/communication/StateManagement';
import {
  useComponentMediator,
  registerComponent
} from '@/lib/communication/ComponentMediator.tsx';

import { ActionGrid } from './ActionGrid';
import { TaskForm } from './TaskForm';
import { ActivityForms, OutboundForm } from './ActivityForms';
import { RoadmapForm } from './RoadmapForm';
import { useFormState } from './hooks/useFormState';
import { useQuickAddValidation } from './hooks/useQuickAddValidation';
import type { QuickAddFormData } from './types';

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickAdd({ isOpen, onClose }: QuickAddProps) {
  const { userData } = useUser();
  const { deals, moveDealToStage } = useDeals();
  const { contacts, createContact, findContactByEmail } = useContacts();
  const { addActivity, addSale } = useActivities();
  const { createTask } = useTasks();
  const { createSuggestion } = useRoadmap();
  const { validateForm } = useQuickAddValidation();
  
  // Original form state for backward compatibility
  const originalFormState = useFormState();
  
  // Decoupled state management (gradual migration)
  const decoupledFormState = useDecoupledFormState('quick-add');
  const componentState = useComponentState('quick-add');
  const businessState = useBusinessState();
  const emit = useEventEmitter();

  // Service adapters for gradual decoupling
  const taskServiceRef = useRef<TaskServiceAdapter>();
  const activityServiceRef = useRef<ActivityServiceAdapter>();
  const notificationServiceRef = useRef<NotificationServiceAdapter>();

  // Initialize service adapters
  useEffect(() => {
    try {
      taskServiceRef.current = getServiceAdapter<TaskServiceAdapter>('task');
      activityServiceRef.current = getServiceAdapter<ActivityServiceAdapter>('activity');
      notificationServiceRef.current = getServiceAdapter<NotificationServiceAdapter>('notification');
    } catch (error) {
      // Service adapters not available - fall back to original implementation
      console.warn('Service adapters not available, using original implementation');
    }
  }, []);

  // Component registration with mediator
  const componentRef = useRef<IFormComponent>({
    async notify(event, data) {
      await emit(event, data);
    },
    subscribe(event, handler) {
      return eventBus.on(event, handler);
    },
    async validate() {
      return validateForm(selectedAction, formData, selectedContact);
    },
    async submit() {
      return handleSubmit(new Event('submit') as any);
    },
    reset() {
      resetForm();
    },
    getData() {
      return formData;
    },
    updateField(field, value) {
      updateFormData({ [field]: value });
    }
  });

  useComponentMediator('quick-add', componentRef.current, {
    type: 'form',
    capabilities: ['form', 'modal', 'business-logic'],
    dependencies: ['deals', 'contacts', 'activities', 'tasks']
  });

  // Use original state management (maintained for compatibility)
  const {
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
  } = originalFormState;

  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [existingDeal, setExistingDeal] = useState<any>(null);
  const [showDealChoice, setShowDealChoice] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Event-driven communication for decoupling
  useEventListener('contact:selected', ({ contact, context }) => {
    if (context === 'quick-add' || !context) {
      setSelectedContact(contact);
      businessState.setSelectedContact(contact);
      
      // Auto-populate form data through event emission
      emit('form:updated', {
        formId: 'quick-add',
        updates: {
          contact_name: contact.full_name || contact.email,
          contactIdentifier: contact.email,
          contactIdentifierType: 'email',
          client_name: contact.company || contact.companies?.name || ''
        }
      });
    }
  });

  useEventListener('deal:created', ({ id, name, stage }) => {
    updateFormData({ deal_id: id, selectedDeal: { id, name, stage } });
    emit('business:workflow-step', {
      workflow: 'quick-add-deal-creation',
      step: 'deal-linked',
      data: { dealId: id }
    });
  });

  useEventListener('ui:notification', ({ message, type }) => {
    // Integrate with existing toast system for backward compatibility
    const toastConfig = {
      duration: type === 'error' ? 5000 : 3000,
      icon: type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
            type === 'error' ? <AlertCircle className="w-4 h-4" /> :
            <Info className="w-4 h-4" />
    };

    switch (type) {
      case 'success':
        toast.success(message, toastConfig);
        break;
      case 'error':
        toast.error(message, toastConfig);
        break;
      case 'warning':
        toast.warning(message, toastConfig);
        break;
      default:
        toast(message, toastConfig);
    }
  });

  // Enhanced error handling with user-friendly messages
  const handleError = useCallback((error: any, actionType: string) => {
    logger.error(`Error in QuickAdd submission (${actionType}):`, error);
    
    setSubmitStatus('error');
    setIsSubmitting(false);
    
    // Handle authentication/authorization errors with specific guidance
    if (authUtils.isAuthError(error)) {
      const userMessage = authUtils.formatAuthError(error);
      toast.error(userMessage, { 
        duration: 6000,
        icon: <AlertCircle className="w-4 h-4" />,
      });
      
      // Provide specific guidance for contact/deal creation issues
      if (error.message?.includes('contacts') || error.message?.includes('permission')) {
        toast.error('Contact creation failed due to permissions. You may need to sign in again or contact support.', {
          duration: 8000,
          icon: <Info className="w-4 h-4" />,
          action: {
            label: 'Refresh Page',
            onClick: () => window.location.reload()
          }
        });
      }
      
      // If session appears to be invalid, offer to diagnose
      if (error.message?.includes('JWT') || error.message?.includes('session')) {
        authUtils.diagnoseSession().then(diagnosis => {
          if (!diagnosis.isValid) {
            logger.warn('Session diagnosis in QuickAdd:', diagnosis);
            toast.error(`Session issue detected: ${diagnosis.issues.join(', ')}. Please sign in again.`, {
              duration: 10000,
              icon: <AlertCircle className="w-4 h-4" />,
              action: {
                label: 'Sign Out',
                onClick: () => {
                  authUtils.clearAuthStorage();
                  window.location.href = '/auth';
                }
              }
            });
          }
        });
      }
    } else {
      // Generic error handling with better user experience
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to create ${actionType}: ${errorMessage}`, {
        duration: 5000,
        icon: <AlertCircle className="w-4 h-4" />,
      });
    }
  }, []);

  const handleClose = () => {
    setSelectedAction(null);
    setSelectedContact(null);
    setShowContactSearch(false);
    setSelectedDate(new Date());
    resetForm();
    onClose();
  };

  const handleActionSelect = (actionId: string) => {
    if (actionId === 'meeting' || actionId === 'proposal' || actionId === 'sale') {
      setSelectedAction(actionId);
      setShowContactSearch(true);
    } else if (actionId === 'outbound') {
      // Outbound can work with or without contacts
      setSelectedAction(actionId);
      // Don't automatically show contact search for outbound
    } else {
      // Task, roadmap, and other actions don't need contact search
      setSelectedAction(actionId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setValidationErrors({});
    setSubmitStatus('idle');
    
    // Validate form
    const validation = validateForm(selectedAction, formData, selectedContact);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus('idle');

    if (selectedAction === 'task') {
      try {
        const taskData = {
          title: formData.title,
          description: formData.description,
          task_type: formData.task_type,
          priority: formData.priority,
          due_date: formData.due_date || undefined,
          assigned_to: userData?.id || '',
          contact_name: formData.contact_name || undefined,
          company_website: formData.company_website || undefined,
        };

        // Try decoupled approach first, fallback to original
        if (taskServiceRef.current) {
          await taskServiceRef.current.execute('create', taskData);
          
          // Events will handle success notification
          await emit('task:created', {
            id: Date.now().toString(), // Temporary ID
            title: taskData.title,
            type: taskData.task_type
          });
        } else {
          // Fallback to original implementation
          await createTask(taskData);
          
          setSubmitStatus('success');
          setIsSubmitting(false);
          toast.success('Task created successfully!', {
            icon: <CheckCircle2 className="w-4 h-4" />,
          });
        }
        
        // Small delay to show success state
        setTimeout(() => {
          handleClose();
        }, 1000);
        
        return;
      } catch (error) {
        handleError(error, 'task');
        return;
      }
    }

    if (selectedAction === 'roadmap') {
      try {
        const roadmapData = {
          title: formData.title,
          description: formData.description,
          type: formData.roadmap_type,
          priority: formData.priority || 'medium'
        };

        await createSuggestion(roadmapData);
        
        setSubmitStatus('success');
        setIsSubmitting(false);
        toast.success('Roadmap suggestion submitted successfully!', {
          icon: <CheckCircle2 className="w-4 h-4" />,
        });
        
        // Small delay to show success state
        setTimeout(() => {
          handleClose();
        }, 1000);
        
        return;
      } catch (error) {
        handleError(error, 'roadmap');
        return;
      }
    }
    
    // Validation for meeting/proposal/sale - require contact
    if ((selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') && !selectedContact) {
      toast.error('Please select a contact first');
      return;
    }
    
    // Validation for meeting/proposal/sale - require company name OR website
    if ((selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale')) {
      if ((!formData.client_name || formData.client_name.trim() === '') && 
          (!formData.company_website || formData.company_website.trim() === '')) {
        toast.error('Please enter either a company name or website');
        return;
      }
    }
    
    // Existing validation for other actions
    if (selectedAction === 'meeting' && !formData.details) {
      toast.error('Please select a meeting type');
      return;
    }
    
    // Outbound validation
    if (selectedAction === 'outbound') {
      if (!formData.outboundType) {
        toast.error('Please select an outbound activity type');
        return;
      }
      if (!formData.outboundCount || parseInt(formData.outboundCount) < 1) {
        toast.error('Please enter a valid quantity');
        return;
      }
    }
    
    // For unified flow (meeting/proposal/sale), use selected contact
    if ((selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') && selectedContact) {
      // Use selected contact info (if not already set)
      if (!formData.contactIdentifier) {
        updateFormData({
          contactIdentifier: selectedContact.email,
          contactIdentifierType: 'email'
        });
      }
      if (!formData.contact_name) {
        // Properly construct contact name with null checks
        const contactName = selectedContact.full_name || 
                           (selectedContact.first_name || selectedContact.last_name ? 
                            `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() : 
                            selectedContact.email);
        updateFormData({ contact_name: contactName });
      }
      // Set company info from contact if not already set
      if (!formData.client_name && selectedContact.company) {
        const companyName = typeof selectedContact.company === 'string' 
          ? selectedContact.company 
          : (selectedContact.company as any)?.name || '';
        updateFormData({ client_name: companyName });
      }
    }

    try {
      if (selectedAction === 'outbound') {
        const activityCount = parseInt(formData.outboundCount) || 1;
        logger.log(`📤 Creating outbound activity with quantity: ${activityCount}...`);
        
        // Build comprehensive details that shows the quantity
        const outboundDetails = [
          `${activityCount} ${formData.outboundType}${activityCount > 1 ? 's' : ''}`,
          formData.details
        ].filter(Boolean).join(' - ');

        await addActivity({
          type: 'outbound',
          client_name: formData.client_name || (selectedContact ? 
            `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() || selectedContact.email :
            'Bulk Outbound Session'),
          details: outboundDetails,
          outbound_type: formData.outboundType,
          quantity: activityCount, // Use 'quantity' field that Dashboard expects for stats
          date: selectedDate.toISOString(),
          deal_id: formData.deal_id,
          // Only include identifier fields if contact is selected
          ...(selectedContact
            ? {
                contactIdentifier: selectedContact.email,
                contactIdentifierType: 'email' as const,
                contact_name: selectedContact.full_name || 
                             `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() ||
                             selectedContact.email
              }
            : {})
        });
        
        logger.log(`✅ Outbound activity created with quantity: ${activityCount}`);
      } else if (selectedAction) {
        logger.log(`📝 Creating ${selectedAction} activity...`);
        
        // Store the final deal ID to use for activity creation
        let finalDealId = formData.deal_id;
        
        // For proposals, check if there's an existing deal in SQL stage for this client
        if (selectedAction === 'proposal' && !finalDealId && formData.client_name) {
          // Look for existing deals in SQL stage for this client
          const sqlStageId = '603b5020-aafc-4646-9195-9f041a9a3f14'; // SQL stage ID
          const existingDealsForClient = deals.filter(
            d => d.stage_id === sqlStageId && 
            d.company?.toLowerCase().includes(formData.client_name.toLowerCase())
          );
          
          if (existingDealsForClient.length > 0) {
            // Found an existing deal - ask user if they want to progress it
            const dealToProgress = existingDealsForClient[0]; // Take the first matching deal
            
            const shouldProgress = await new Promise<boolean>((resolve) => {
              // Create a modal to ask the user
              const modal = document.createElement('div');
              modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4';
              modal.innerHTML = `
                <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full">
                  <h3 class="text-lg font-semibold text-white mb-3">Existing Deal Found</h3>
                  <p class="text-gray-300 mb-4">
                    Found an existing deal "<strong>${dealToProgress.name}</strong>" in SQL stage for ${formData.client_name}.
                  </p>
                  <p class="text-gray-400 text-sm mb-6">
                    Would you like to progress this deal to Opportunity stage, or create a new deal?
                  </p>
                  <div class="flex gap-3">
                    <button id="progress-deal" class="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium">
                      Progress Existing Deal
                    </button>
                    <button id="create-new" class="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium">
                      Create New Deal
                    </button>
                  </div>
                </div>
              `;
              
              document.body.appendChild(modal);
              
              const progressBtn = modal.querySelector('#progress-deal');
              const createNewBtn = modal.querySelector('#create-new');
              
              progressBtn?.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
              });
              
              createNewBtn?.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
              });
            });
            
            if (shouldProgress) {
              // Progress the existing deal to Opportunity stage
              const opportunityStageId = '8be6a854-e7d0-41b5-9057-03b2213e7697'; // Opportunity stage ID (corrected)
              
              try {
                await moveDealToStage(dealToProgress.id, opportunityStageId);
                finalDealId = dealToProgress.id;
                
                // Update the deal value if admin has provided revenue split
                if (canSplitDeals(userData)) {
                  const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
                  const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
                  if (oneOff > 0 || monthly > 0) {
                    const newValue = (monthly * 3) + oneOff; // LTV calculation
                    await supabase
                      .from('deals')
                      .update({ value: newValue })
                      .eq('id', dealToProgress.id);
                  }
                }
                
                toast.success(`📈 Progressed "${dealToProgress.name}" to Opportunity stage`);
                logger.log(`✅ Progressed existing deal ${dealToProgress.id} to Opportunity stage`);
              } catch (error) {
                logger.error('Error progressing deal:', error);
                // Fall back to creating a new deal
              }
            }
          }
        }
        
        // For sales, check if there's an existing deal in Opportunity OR SQL stage for this client
        if (selectedAction === 'sale' && !finalDealId && formData.client_name) {
          // Look for existing deals in Opportunity stage first
          const opportunityStageId = '8be6a854-e7d0-41b5-9057-03b2213e7697'; // Opportunity stage ID
          const sqlStageId = '603b5020-aafc-4646-9195-9f041a9a3f14'; // SQL stage ID
          
          let existingDealsForClient = deals.filter(
            d => d.stage_id === opportunityStageId && 
            d.company?.toLowerCase().includes(formData.client_name.toLowerCase())
          );
          
          // If no deals in Opportunity, check SQL stage (meetings)
          if (existingDealsForClient.length === 0) {
            existingDealsForClient = deals.filter(
              d => d.stage_id === sqlStageId && 
              d.company?.toLowerCase().includes(formData.client_name.toLowerCase())
            );
          }
          
          if (existingDealsForClient.length > 0) {
            // Found an existing deal - ask user if they want to progress it
            const dealToProgress = existingDealsForClient[0]; // Take the first matching deal
            const isInSQL = dealToProgress.stage_id === sqlStageId;
            const currentStage = isInSQL ? 'SQL' : 'Opportunity';
            
            const shouldProgress = await new Promise<boolean>((resolve) => {
              // Create a modal to ask the user
              const modal = document.createElement('div');
              modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4';
              modal.innerHTML = `
                <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full">
                  <h3 class="text-lg font-semibold text-white mb-3">Existing Deal Found</h3>
                  <p class="text-gray-300 mb-4">
                    Found an existing deal "<strong>${dealToProgress.name}</strong>" in ${currentStage} stage for ${formData.client_name}.
                  </p>
                  <p class="text-gray-400 text-sm mb-6">
                    Would you like to ${isInSQL ? 'fast-track this deal directly to Signed' : 'close this deal as won'} (move to Signed stage), or create a new deal?
                  </p>
                  <div class="flex gap-3">
                    <button id="progress-deal" class="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium">
                      ${isInSQL ? 'Fast-Track to Signed' : 'Close Existing Deal'}
                    </button>
                    <button id="create-new" class="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium">
                      Create New Deal
                    </button>
                  </div>
                </div>
              `;
              
              document.body.appendChild(modal);
              
              const progressBtn = modal.querySelector('#progress-deal');
              const createNewBtn = modal.querySelector('#create-new');
              
              progressBtn?.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
              });
              
              createNewBtn?.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
              });
            });
            
            if (shouldProgress) {
              // Progress the existing deal to Signed stage
              const signedStageId = '207a94db-abd8-43d8-ba21-411be66183d2'; // Signed stage ID
              
              try {
                await moveDealToStage(dealToProgress.id, signedStageId);
                finalDealId = dealToProgress.id;
                
                // Update the deal value with the actual sale amount
                const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
                const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
                let dealValue = 0;
                
                if (canSplitDeals(userData) && (oneOff > 0 || monthly > 0)) {
                  dealValue = (monthly * 3) + oneOff; // LTV calculation
                } else {
                  dealValue = parseFloat(formData.amount || '0') || 0;
                }
                
                if (dealValue > 0) {
                  await supabase
                    .from('deals')
                    .update({ value: dealValue })
                    .eq('id', dealToProgress.id);
                }
                
                toast.success(`🎉 Closed "${dealToProgress.name}" as won!`);
                logger.log(`✅ Progressed existing deal ${dealToProgress.id} to Signed stage`);
              } catch (error) {
                logger.error('Error progressing deal to Signed:', error);
                // Fall back to creating a new deal
              }
            }
          }
        }
        
        // For meetings, proposals, and sales without a deal, create a deal first
        if ((selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') && !finalDealId) {
          logger.log(`🎯 No deal selected for ${selectedAction} - creating new deal automatically...`);
          
          try {
            // Determine the appropriate stage based on action type
            let stageName = 'SQL';
            let probability = 20;
            let dealValue = 0;
            
            if (selectedAction === 'proposal') {
              stageName = 'Opportunity';
              probability = 30;
              // For proposals, use the amount as the deal value
              dealValue = parseFloat(formData.amount || '0') || 0;
            } else if (selectedAction === 'sale') {
              stageName = 'Signed';
              probability = 100;
              // For sales, calculate LTV from subscription and one-off amounts
              const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
              const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
              dealValue = (monthly * 3) + oneOff; // LTV calculation
            }
            
            // Get the appropriate stage
            const { data: stages } = await supabase
              .from('deal_stages')
              .select('id')
              .eq('name', stageName)
              .single();
            
            const stageId = stages?.id;
            
            if (stageId && userData?.id) {
              // Determine company name - use provided name or extract from website
              const companyName = formData.client_name || 
                                (formData.company_website ? 
                                 formData.company_website.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0] : 
                                 'Unknown Company');
              
              // Create a new deal (only if we have a user ID)
              const { data: newDeal, error: dealError } = await supabase
                .from('deals')
                .insert({
                  name: `${companyName} - ${formData.details || selectedAction}`,
                  company: companyName,
                  company_website: formData.company_website || null,
                  value: dealValue,
                  stage_id: stageId,
                  owner_id: userData.id, // Now guaranteed to exist
                  probability: probability,
                  status: 'active',
                  expected_close_date: addDays(new Date(), 30).toISOString(),
                  contact_email: formData.contactIdentifier,
                  contact_name: formData.contact_name || companyName
                })
                .select()
                .single();
              
              if (!dealError && newDeal) {
                finalDealId = newDeal.id;  // Use the local variable
                logger.log(`✅ Created deal ${newDeal.id} for ${selectedAction}`);
                toast.success(`📊 Deal created and linked to ${selectedAction}`);
              } else {
                logger.warn(`Failed to create deal for ${selectedAction}:`, dealError);
              }
            }
          } catch (error) {
            logger.error(`Error creating deal for ${selectedAction}:`, error);
            // Continue anyway - we can still create the activity without a deal
          }
        }
        
        // For proposals, use the amount field
        let proposalAmount;
        if (selectedAction === 'proposal') {
          proposalAmount = parseFloat(formData.amount || '0') || 0;
        }

        // Create the appropriate activity or sale
        if (selectedAction === 'sale') {
          logger.log(`💰 Creating sale with deal_id: ${finalDealId}`);
          // Calculate total sale amount from subscription and one-off
          const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
          const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
          const saleAmount = (monthly * 3) + oneOff; // LTV calculation
          
          await addSale({
            client_name: formData.client_name || formData.contact_name || 'Unknown',
            amount: saleAmount,
            details: formData.details || (monthly > 0 && oneOff > 0 ? 'Subscription + One-off Sale' : monthly > 0 ? 'Subscription Sale' : 'One-off Sale'),
            saleType: monthly > 0 ? 'subscription' : 'one-off',
            date: selectedDate.toISOString(),
            deal_id: finalDealId,
            contactIdentifier: formData.contactIdentifier,
            contactIdentifierType: formData.contactIdentifierType || 'email',
            contact_name: formData.contact_name,
            // Pass the split values for proper recording
            oneOffRevenue: oneOff,
            monthlyMrr: monthly
          });
          logger.log(`✅ Sale created successfully with deal_id: ${finalDealId}`);
        } else {
          logger.log(`📝 About to create ${selectedAction} activity with deal_id: ${finalDealId}`);
          await addActivity({
            type: selectedAction as 'meeting' | 'proposal',
            client_name: formData.client_name || 'Unknown',
            details: formData.details,
            amount: selectedAction === 'proposal' ? proposalAmount : undefined,
            date: selectedDate.toISOString(),
            deal_id: finalDealId,  // Use the finalDealId which includes the newly created deal
            contactIdentifier: formData.contactIdentifier,
            contactIdentifierType: formData.contactIdentifierType || 'email',
            contact_name: formData.contact_name,
            status: selectedAction === 'meeting' ? (formData.status as 'completed' | 'pending' | 'cancelled' | 'no_show') : 'completed'
          });
          logger.log(`✅ ${selectedAction} activity created successfully with deal_id: ${finalDealId}`);
        }
      }
      
      setSubmitStatus('success');
      setIsSubmitting(false);
      
      // Create appropriate success message
      let successMessage = '';
      if (selectedAction === 'outbound') {
        const activityCount = parseInt(formData.outboundCount) || 1;
        successMessage = `${activityCount} ${formData.outboundType}${activityCount > 1 ? 's' : ''} added successfully!`;
      } else {
        successMessage = `${selectedAction === 'sale' ? 'Sale' : selectedAction} added successfully!`;
      }
      
      toast.success(successMessage, {
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (error) {
      handleError(error, selectedAction || 'item');
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 0.8
            }}
            className="relative bg-gray-900/95 border border-gray-800/50 rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-2xl backdrop-blur-xl sm:m-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/30 rounded-3xl -z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] rounded-3xl -z-10" />
            
            <motion.div 
              className="w-12 h-1 rounded-full bg-gray-800 absolute -top-8 left-1/2 -translate-x-1/2 sm:hidden"
              initial={{ width: '2rem' }}
              animate={{ width: '3rem' }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            />
            
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-xl font-semibold text-white/90 tracking-wide">Quick Add</h2>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 hover:bg-gray-800/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {!showContactSearch && !selectedAction && (
              <ActionGrid onActionSelect={handleActionSelect} />
            )}

            {!showContactSearch && selectedAction === 'task' && (
              <TaskForm
                formData={formData}
                setFormData={setFormData}
                validationErrors={validationErrors}
                isSubmitting={isSubmitting}
                submitStatus={submitStatus}
                onSubmit={handleSubmit}
                onBack={() => setSelectedAction(null)}
              />
            )}
            {!showContactSearch && selectedAction === 'roadmap' && (
              <RoadmapForm
                formData={formData}
                setFormData={setFormData}
                validationErrors={validationErrors}
                isSubmitting={isSubmitting}
                submitStatus={submitStatus}
                onSubmit={handleSubmit}
                onBack={() => setSelectedAction(null)}
              />
            )}

            {!showContactSearch && 
             (selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') && 
             selectedContact && (
              <ActivityForms
                selectedAction={selectedAction}
                selectedContact={selectedContact}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                formData={formData}
                setFormData={setFormData}
                validationErrors={validationErrors}
                isSubmitting={isSubmitting}
                submitStatus={submitStatus}
                onSubmit={handleSubmit}
                onBack={() => setSelectedAction(null)}
                onChangeContact={() => {
                  setSelectedContact(null);
                  setShowContactSearch(true);
                }}
              />
            )}

            {/* Outbound Form - Works with or without contacts */}
            {!showContactSearch && selectedAction === 'outbound' && (
              <OutboundForm
                formData={formData}
                setFormData={setFormData}
                validationErrors={validationErrors}
                isSubmitting={isSubmitting}
                submitStatus={submitStatus}
                onSubmit={handleSubmit}
                onBack={() => setSelectedAction(null)}
                onAddContact={() => setShowContactSearch(true)}
                selectedContact={selectedContact}
                onChangeContact={() => {
                  setSelectedContact(null);
                  setShowContactSearch(true);
                }}
              />
            )}
          </motion.div>

          {/* Contact Search Modal */}
          {showContactSearch && (
            <ContactSearchModal
              isOpen={showContactSearch}
              onClose={() => {
                setShowContactSearch(false);
              }}
              onContactSelect={(contact) => {
                // Pre-populate form data with contact info
                const contactName = contact.full_name || 
                                  (contact.first_name || contact.last_name ? 
                                   `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
                                   contact.email);
                
                // Extract company information
                let companyName = '';
                let websiteUrl = '';
                
                if (contact._form_website || contact.company_website) {
                  websiteUrl = contact._form_website || contact.company_website;
                  if (!companyName && websiteUrl) {
                    const cleanUrl = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
                    const domain = cleanUrl.split('.')[0];
                    companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
                  }
                }
                
                if (contact.company || contact.company_name) {
                  companyName = contact.company || contact.company_name;
                } else if (contact.companies?.name) {
                  companyName = contact.companies.name;
                  if (!websiteUrl) {
                    websiteUrl = contact.companies.website || '';
                  }
                } else if (!companyName) {
                  const domain = contact.email?.split('@')[1];
                  if (domain && !['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'].includes(domain.toLowerCase())) {
                    const domainParts = domain.split('.');
                    if (domainParts.length >= 2) {
                      companyName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
                      if (!websiteUrl) {
                        websiteUrl = `www.${domain}`;
                      }
                    }
                  }
                }
                
                updateFormData({
                  contact_name: contactName,
                  contactIdentifier: contact.email,
                  contactIdentifierType: 'email',
                  client_name: companyName || formData.client_name,
                  company_website: websiteUrl || formData.company_website
                });
                
                setSelectedContact(contact);
                setShowContactSearch(false);
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}