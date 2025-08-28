import { useState, useCallback } from 'react';
import { Plus, X, Phone, FileText, Users, PoundSterling, CheckSquare, Calendar, Clock, Target, Flag, Zap, Timer, Coffee, ArrowRight, Mail, Building2, UserPlus, Search, Briefcase, Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivities } from '@/lib/hooks/useActivities';
import { useTasks } from '@/lib/hooks/useTasks';
import { useContacts } from '@/lib/hooks/useContacts';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays, addHours, setHours, setMinutes, startOfWeek, addWeeks } from 'date-fns';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'sonner';
import { useDeals } from '@/lib/hooks/useDeals';
import { IdentifierField, IdentifierType } from './IdentifierField';
import { DealSelector } from './DealSelector';
import { DealWizard } from './DealWizard';
import { ContactSearchModal } from './ContactSearchModal';
import { useCompanies } from '@/lib/hooks/useCompanies';
import type { Company } from '@/lib/database/models';
import { canSplitDeals } from '@/lib/utils/adminUtils';
import logger from '@/lib/utils/logger';
import { supabase, authUtils } from '@/lib/supabase/clientV2';
import { cn } from '@/lib/utils';

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickAdd({ isOpen, onClose }: QuickAddProps) {
  const { userData } = useUser();
  const { deals, moveDealToStage } = useDeals();
  const { contacts, createContact, findContactByEmail } = useContacts();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDealWizard, setShowDealWizard] = useState(false);
  const [existingDeal, setExistingDeal] = useState<any>(null);
  const [showDealChoice, setShowDealChoice] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
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
    contactIdentifierType: 'unknown' as IdentifierType,
    status: 'completed',
    // Task specific fields
    title: '',
    description: '',
    task_type: 'call' as const,
    priority: 'medium' as const,
    due_date: '',
    contact_name: '',
    company_website: '',
    // Deal linking
    deal_id: null as string | null,
    selectedDeal: null as any
  });

  // Validation function
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (selectedAction === 'task') {
      if (!formData.title.trim()) {
        errors.title = 'Task title is required';
      }
    }
    
    if (selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') {
      if (!selectedContact) {
        errors.contact = 'Please select a contact';
      }
      // Company name is required only if no website is provided
      if (!formData.client_name?.trim() && !formData.company_website?.trim()) {
        errors.client_name = 'Either company name or website is required';
      }
      if (selectedAction === 'meeting' && !formData.details) {
        errors.details = 'Meeting type is required';
      }
    }
    
    if (selectedAction !== 'outbound' && selectedAction !== 'meeting' && selectedAction !== 'proposal' && selectedAction !== 'sale' && selectedAction !== 'task') {
      if (!formData.contactIdentifier) {
        errors.contactIdentifier = 'Contact identifier is required';
      }
      if (formData.contactIdentifierType === 'unknown') {
        errors.contactIdentifier = 'Please enter a valid email, phone number, or LinkedIn URL';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedAction, formData, selectedContact]);

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

  // Reset selectedAction and contact when modal is closed
  const handleClose = () => {
    setSelectedAction(null);
    setSelectedContact(null);
    setShowContactSearch(false);
    setSelectedDate(new Date());
    setShowCalendar(false);
    setShowDealWizard(false);
    setFormData({
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
      title: '',
      description: '',
      task_type: 'call',
      priority: 'medium',
      due_date: '',
      contact_name: '',
      company_website: '',
      deal_id: null,
      deal_name: '',
      selectedDeal: null
    });
    onClose();
  };

  const { addActivity, addSale } = useActivities();
  const { createTask } = useTasks();

  // Task type options with icons and colors
  const taskTypes = [
    { value: 'call', label: 'Phone Call', icon: '📞', color: 'bg-blue-500/20 text-blue-400', iconColor: 'text-blue-500' },
    { value: 'email', label: 'Email', icon: '✉️', color: 'bg-green-500/20 text-green-400', iconColor: 'text-green-500' },
    { value: 'meeting', label: 'Meeting', icon: '🤝', color: 'bg-purple-500/20 text-purple-400', iconColor: 'text-purple-500' },
    { value: 'follow_up', label: 'Follow Up', icon: '🔄', color: 'bg-orange-500/20 text-orange-400', iconColor: 'text-orange-500' },
    { value: 'demo', label: 'Demo', icon: '🎯', color: 'bg-indigo-500/20 text-indigo-400', iconColor: 'text-indigo-500' },
    { value: 'proposal', label: 'Proposal', icon: '📋', color: 'bg-yellow-500/20 text-yellow-400', iconColor: 'text-yellow-500' },
    { value: 'general', label: 'General', icon: '⚡', color: 'bg-gray-500/20 text-gray-400', iconColor: 'text-gray-400' },
  ];

  // Priority options with visual indicators
  const priorities = [
    { value: 'low', label: 'Low', icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30', ringColor: 'ring-green-500/30' },
    { value: 'medium', label: 'Medium', icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', ringColor: 'ring-yellow-500/30' },
    { value: 'high', label: 'High', icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', ringColor: 'ring-orange-500/30' },
    { value: 'urgent', label: 'Urgent', icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', ringColor: 'ring-red-500/30' },
  ];

  // Smart quick date options
  const getSmartQuickDates = () => {
    const now = new Date();
    return [
      {
        label: 'In 1 Hour',
        value: format(addHours(now, 1), "yyyy-MM-dd'T'HH:mm"),
        icon: '⏰',
        description: 'Quick follow up'
      },
      {
        label: 'End of Day',
        value: format(setHours(setMinutes(now, 0), 17), "yyyy-MM-dd'T'HH:mm"),
        icon: '🌅',
        description: 'Before close'
      },
      {
        label: 'Tomorrow 9AM',
        value: format(setHours(setMinutes(addDays(now, 1), 0), 9), "yyyy-MM-dd'T'HH:mm"),
        icon: '📅',
        description: 'Start fresh'
      },
      {
        label: 'Next Monday',
        value: format(setHours(setMinutes(addDays(startOfWeek(addWeeks(now, 1)), 1), 0), 9), "yyyy-MM-dd'T'HH:mm"),
        icon: '📆',
        description: 'Next week'
      }
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setValidationErrors({});
    setSubmitStatus('idle');
    
    // Validate form
    if (!validateForm()) {
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

        await createTask(taskData);
        
        setSubmitStatus('success');
        setIsSubmitting(false);
        toast.success('Task created successfully!', {
          icon: <CheckCircle2 className="w-4 h-4" />,
        });
        
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
    
    // For unified flow (meeting/proposal/sale), use selected contact
    if ((selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') && selectedContact) {
      // Use selected contact info (if not already set)
      if (!formData.contactIdentifier) {
        formData.contactIdentifier = selectedContact.email;
        formData.contactIdentifierType = 'email';
      }
      if (!formData.contact_name) {
        // Properly construct contact name with null checks
        formData.contact_name = selectedContact.full_name || 
                                (selectedContact.first_name || selectedContact.last_name ? 
                                 `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() : 
                                 selectedContact.email);
      }
      // Set company info from contact if not already set
      if (!formData.client_name && selectedContact.company) {
        formData.client_name = selectedContact.company;
      }
      
      // Debug logging to verify data
      logger.log('📝 Contact data for submission:', {
        contact_name: formData.contact_name,
        client_name: formData.client_name,
        company_website: formData.company_website,
        contactIdentifier: formData.contactIdentifier,
        selectedContact: selectedContact
      });
    }
    
    // For other non-outbound actions, require identifier
    if (selectedAction !== 'outbound' && selectedAction !== 'meeting' && selectedAction !== 'proposal' && selectedAction !== 'sale') {
      if (!formData.contactIdentifier) {
        toast.error('Please provide a contact identifier (email, phone number, or LinkedIn URL)');
        return;
      }
      if (formData.contactIdentifierType === 'unknown') {
        toast.error('Please enter a valid email, phone number, or LinkedIn URL');
        return;
      }
    }

    try {
      if (selectedAction === 'outbound') {
        logger.log('📤 Creating outbound activity...');
        // Always add the activity, but only pass identifier fields if present
        await addActivity({
          type: 'outbound',
          client_name: formData.client_name || 'Unknown',
          details: formData.outboundType,
          quantity: parseInt(formData.outboundCount) || 1,
          date: selectedDate.toISOString(),
          deal_id: formData.deal_id,
          // Only include identifier fields if present
          ...(formData.contactIdentifier
            ? {
                contactIdentifier: formData.contactIdentifier,
                contactIdentifierType: formData.contactIdentifierType
              }
            : {})
        });
        logger.log('✅ Outbound activity created successfully');
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
      toast.success(`${selectedAction === 'outbound' ? 'Outbound' : selectedAction === 'sale' ? 'Sale' : selectedAction} added successfully!`, {
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      
      // Small delay to show success state
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (error) {
      handleError(error, selectedAction || 'item');
    }
  };

  const quickActions = [
    { id: 'deal', icon: Target, label: 'Create Deal', color: 'purple' },
    { id: 'task', icon: CheckSquare, label: 'Add Task', color: 'indigo' },
    { id: 'sale', icon: PoundSterling, label: 'Add Sale', color: 'emerald' },
    { id: 'outbound', icon: Phone, label: 'Add Outbound', color: 'blue' },
    { id: 'meeting', icon: Users, label: 'Add Meeting', color: 'violet' },
    { id: 'proposal', icon: FileText, label: 'Add Proposal', color: 'orange' },
  ];

  const handleQuickDate = (dateValue: string) => {
    setFormData(prev => ({
      ...prev,
      due_date: dateValue
    }));
  };

  const selectedTaskType = taskTypes.find(t => t.value === formData.task_type);
  const selectedPriority = priorities.find(p => p.value === formData.priority);

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

            {showContactSearch ? null : !selectedAction ? (
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
                variants={{
                  show: {
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                initial="hidden"
                animate="show"
              >
                {quickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    type="button"
                    variants={{
                      hidden: { y: 20, opacity: 0 },
                      show: { y: 0, opacity: 1 }
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (action.id === 'deal') {
                        // For Deal, open ContactSearchModal directly
                        setSelectedAction(action.id);
                        setShowContactSearch(true);
                      } else if (action.id === 'meeting' || action.id === 'proposal' || action.id === 'sale') {
                        // For Meeting, Proposal, Sale - set action and open ContactSearchModal
                        setSelectedAction(action.id);
                        setShowContactSearch(true);
                      } else {
                        setSelectedAction(action.id);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl ${
                      action.color === 'blue'
                        ? 'bg-blue-400/5'
                        : action.color === 'orange'
                          ? 'bg-orange-500/10'
                          : action.color === 'indigo'
                            ? 'bg-indigo-500/10'
                            : action.color === 'purple'
                              ? 'bg-purple-500/10'
                              : `bg-${action.color}-500/10`
                    } border ${
                      action.color === 'blue'
                        ? 'border-blue-500/10'
                        : action.color === 'orange'
                          ? 'border-orange-500/20'
                          : action.color === 'indigo'
                            ? 'border-indigo-500/20'
                            : action.color === 'purple'
                              ? 'border-purple-500/20'
                              : `border-${action.color}-500/20`
                    } hover:bg-${action.color}-500/20 transition-all duration-300 group backdrop-blur-sm`}
                  >
                    <div className={`p-3 rounded-xl ${
                      action.color === 'blue'
                        ? 'bg-blue-400/5'
                        : action.color === 'orange'
                          ? 'bg-orange-500/10'
                          : action.color === 'indigo'
                            ? 'bg-indigo-500/10'
                            : action.color === 'purple'
                              ? 'bg-purple-500/10'
                              : `bg-${action.color}-500/10`
                    } transition-all duration-300 group-hover:scale-110 group-hover:bg-${action.color}-500/20 ring-1 ${
                      action.color === 'blue'
                        ? 'ring-blue-500/50 group-hover:ring-blue-500/60'
                        : action.color === 'orange'
                          ? 'ring-orange-500/30 group-hover:ring-orange-500/50'
                          : action.color === 'indigo'
                            ? 'ring-indigo-500/30 group-hover:ring-indigo-500/50'
                            : action.color === 'purple'
                              ? 'ring-purple-500/30 group-hover:ring-purple-500/50'
                              : `ring-${action.color}-500/30 group-hover:ring-${action.color}-500/50`
                    } backdrop-blur-sm mb-3`}>
                      <action.icon className={`w-6 h-6 ${
                        action.color === 'blue'
                          ? 'text-blue-500'
                          : action.color === 'orange'
                            ? 'text-orange-500'
                            : action.color === 'indigo'
                              ? 'text-indigo-500'
                              : action.color === 'purple'
                                ? 'text-purple-500'
                                : `text-${action.color}-500`
                      }`} />
                    </div>
                    <span className="text-sm font-medium text-white/90">{action.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            ) : showDealWizard ? (
              // Don't show any form when DealWizard is active
              null
            ) : selectedAction === 'task' ? (
              // Amazing Task Creation Form
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Header with back button */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="p-2 hover:bg-gray-800/50 rounded-xl transition-colors"
                  >
                    <ArrowRight className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <CheckSquare className="w-6 h-6 text-indigo-500" />
                      Create New Task
                    </h3>
                    <p className="text-gray-400 text-sm">Set up your task quickly and efficiently</p>
                  </div>
                </div>

                {/* Task Title */}
                <div className="space-y-3">
                  <label className="text-lg font-semibold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-400" />
                    What needs to be done? *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Call John about the proposal"
                    className={cn(
                      "w-full bg-gray-800/50 border text-white text-lg p-4 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all",
                      validationErrors.title 
                        ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" 
                        : "border-gray-600/50"
                    )}
                    required
                  />
                  {validationErrors.title && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.title}
                    </p>
                  )}
                </div>

                {/* Task Type & Priority Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Task Type */}
                  <div className="space-y-3">
                    <label className="text-base font-medium text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Task Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {taskTypes.slice(0, 4).map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, task_type: type.value as any }))}
                          className={`p-3 rounded-xl border transition-all ${
                            formData.task_type === type.value
                              ? `${type.color} border-current`
                              : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{type.icon}</span>
                            <span className="text-xs font-medium">{type.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {taskTypes.slice(4).map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, task_type: type.value as any }))}
                          className={`p-3 rounded-xl border transition-all ${
                            formData.task_type === type.value
                              ? `${type.color} border-current`
                              : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{type.icon}</span>
                            <span className="text-xs font-medium">{type.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="space-y-3">
                    <label className="text-base font-medium text-white flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-400" />
                      Priority Level
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {priorities.map((priority) => (
                        <button
                          key={priority.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, priority: priority.value as any }))}
                          className={`p-3 rounded-xl border transition-all ${
                            formData.priority === priority.value
                              ? `${priority.color} ${priority.ringColor} ring-2`
                              : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{priority.icon}</span>
                            <span className="text-xs font-medium">{priority.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Due Date Section */}
                <div className="space-y-4">
                  <label className="text-base font-medium text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    When is this due?
                  </label>
                  
                  {/* Smart Quick Date Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {getSmartQuickDates().map((quick) => (
                      <button
                        key={quick.label}
                        type="button"
                        onClick={() => handleQuickDate(quick.value)}
                        className={`p-3 rounded-xl border transition-all group ${
                          formData.due_date === quick.value
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-gray-800/30 border-gray-600/30 text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{quick.icon}</span>
                          <div className="text-left">
                            <div className="text-sm font-medium">{quick.label}</div>
                            <div className="text-xs opacity-70">{quick.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Custom Date Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Or set a custom date & time</label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-600/50 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-3">
                  <label className="text-base font-medium text-white">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Any additional context or notes..."
                    rows={3}
                    className="w-full bg-gray-800/50 border border-gray-600/50 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all resize-none"
                  />
                </div>

                {/* Contact & Company Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Contact Name</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                      placeholder="John Smith"
                      className="w-full bg-gray-800/30 border border-gray-600/30 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Company Website</label>
                    <input
                      type="text"
                      value={formData.company_website}
                      onChange={(e) => {
                        let website = e.target.value.trim();
                        
                        // Auto-add www. if user enters a domain without it
                        if (website && !website.startsWith('www.') && !website.startsWith('http')) {
                          // Check if it looks like a domain (has a dot and no spaces)
                          if (website.includes('.') && !website.includes(' ')) {
                            website = `www.${website}`;
                          }
                        }
                        
                        setFormData(prev => ({ ...prev, company_website: website }));
                      }}
                      placeholder="www.company.com"
                      className="w-full bg-gray-800/30 border border-gray-600/30 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="flex-1 py-3 px-4 bg-gray-800/50 border border-gray-600/50 text-gray-300 rounded-xl hover:bg-gray-700/50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 py-3 px-4 text-white rounded-xl transition-all font-medium shadow-lg flex items-center justify-center gap-2",
                      submitStatus === 'success' 
                        ? "bg-green-600 hover:bg-green-700 shadow-green-500/25"
                        : isSubmitting
                          ? "bg-gray-600 cursor-not-allowed"
                          : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/25"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating...
                      </>
                    ) : submitStatus === 'success' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Created!
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-5 h-5" />
                        Create Task
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (selectedAction === 'meeting' || selectedAction === 'proposal' || selectedAction === 'sale') && selectedContact ? (
              // Show activity form only after contact is selected
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Compact Header with contact info */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedAction(null)}
                          className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
                        >
                          <ArrowRight className="w-4 h-4 text-gray-400 rotate-180" />
                        </button>
                        <div>
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            {selectedAction === 'meeting' && <><Users className="w-5 h-5 text-violet-500" /> Add Meeting</>}
                            {selectedAction === 'proposal' && <><FileText className="w-5 h-5 text-orange-500" /> Add Proposal</>}
                            {selectedAction === 'sale' && <><PoundSterling className="w-5 h-5 text-emerald-500" /> Add Sale</>}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-400">for</span>
                            <span className="text-sm text-[#37bd7e] font-medium">
                              {selectedContact.full_name || 
                               (selectedContact.first_name || selectedContact.last_name ? 
                                `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() : 
                                selectedContact.email)}
                            </span>
                            {selectedContact.company && (
                              <span className="text-sm text-gray-500">• {selectedContact.company}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContact(null);
                                setShowContactSearch(true);
                              }}
                              className="text-xs text-gray-400 hover:text-[#37bd7e] ml-2"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                {/* Compact Date Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-400">
                      {selectedAction === 'meeting' ? 'Meeting Date' : 
                       selectedAction === 'proposal' ? 'Proposal Date' : 
                       selectedAction === 'sale' ? 'Sale Date' : 'Date'}
                    </label>
                    <div className="flex gap-2">
                      {[
                        { label: 'Today', date: new Date() },
                        { label: 'Yesterday', date: addDays(new Date(), -1) },
                        { label: 'Last Week', date: addWeeks(new Date(), -1) }
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            setSelectedDate(option.date);
                            setShowCalendar(false);
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                            format(selectedDate, 'yyyy-MM-dd') === format(option.date, 'yyyy-MM-dd')
                              ? 'bg-[#37bd7e]/20 border-[#37bd7e] text-[#37bd7e]'
                              : 'bg-gray-800/30 border-gray-700/30 text-gray-300 hover:bg-gray-700/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-3 py-2.5 text-white text-left hover:bg-gray-700/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#37bd7e]" />
                      <span className="text-sm">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                    </div>
                    <span className="text-xs text-gray-400">Change</span>
                  </button>
                  
                  {showCalendar && (
                    <div className="absolute left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4 z-20 shadow-xl">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDate(date);
                            setShowCalendar(false);
                          }
                        }}
                        className="bg-transparent [&_.rdp-day]:text-white [&_.rdp-day_button:hover]:bg-[#37bd7e]/20 [&_.rdp-day_button:focus]:bg-[#37bd7e]/20 [&_.rdp-day_selected]:!bg-[#37bd7e] [&_.rdp-day_selected]:hover:!bg-[#2da76c] [&_.rdp-caption]:text-white [&_.rdp-head_cell]:text-gray-400"
                      />
                    </div>
                  )}
                </div>

                {/* Meeting-specific fields - Compact */}
                {selectedAction === 'meeting' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-400">
                        Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-colors"
                        value={formData.details}
                        onChange={(e) => setFormData({...formData, details: e.target.value})}
                      >
                        <option value="">Select type</option>
                        <option value="Discovery">Discovery</option>
                        <option value="Demo">Demo</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="Proposal">Proposal Review</option>
                        <option value="Client Call">Client Call</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-400">
                        Status
                      </label>
                      <select
                        className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-colors"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Scheduled</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No Show</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Proposal-specific fields - Compact */}
                {selectedAction === 'proposal' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-400">
                      Proposal Value (£)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter proposal value"
                      className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-colors"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                )}

                {/* Sale-specific fields - Compact with both inputs */}
                {selectedAction === 'sale' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-400">
                          Monthly Subscription (£)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors"
                          value={formData.monthlyMrr || ''}
                          onChange={(e) => setFormData({...formData, monthlyMrr: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-400">
                          One-off Amount (£)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors"
                          value={formData.oneOffRevenue || ''}
                          onChange={(e) => setFormData({...formData, oneOffRevenue: e.target.value})}
                        />
                      </div>
                    </div>
                    {(formData.monthlyMrr || formData.oneOffRevenue) && (
                      <div className="px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-xs text-emerald-400">
                          Deal Value: £{((parseFloat(formData.monthlyMrr || '0') * 3) + parseFloat(formData.oneOffRevenue || '0')).toFixed(2)}
                          {formData.monthlyMrr && <span className="text-emerald-300/60 text-xs"> (3mo LTV)</span>}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Company Information - Required */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-400">
                      Company Name <span className="text-gray-500 text-xs">(or use website below)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Acme Inc."
                      className={cn(
                        "w-full bg-gray-800/50 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors",
                        validationErrors.client_name 
                          ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" 
                          : !formData.client_name && selectedAction
                            ? 'border-amber-500/50' 
                            : 'border-gray-600/50'
                      )}
                      value={formData.client_name || ''}
                      onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                      required
                    />
                    {validationErrors.client_name && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationErrors.client_name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-400">
                      Website
                    </label>
                    <input
                      type="text"
                      placeholder="www.acme.com"
                      className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors"
                      value={formData.company_website || ''}
                      onChange={(e) => {
                        let website = e.target.value.trim();
                        
                        // Auto-add www. if user enters a domain without it
                        if (website && !website.startsWith('www.') && !website.startsWith('http')) {
                          // Check if it looks like a domain (has a dot and no spaces)
                          if (website.includes('.') && !website.includes(' ')) {
                            website = `www.${website}`;
                          }
                        }
                        
                        setFormData({...formData, company_website: website});
                      }}
                    />
                  </div>
                </div>

                {/* Deal Information - Optional */}
                <details className="group">
                  <summary className="cursor-pointer list-none flex items-center justify-between p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-300">Deal Details</span>
                      <span className="text-xs text-gray-500">(Optional)</span>
                    </div>
                    <div className="text-xs text-purple-400">
                      {selectedAction === 'sale' ? 'Signed stage' : selectedAction === 'proposal' ? 'Opportunity stage' : 'SQL stage'}
                    </div>
                  </summary>
                  <div className="mt-2 space-y-2 p-3">
                    <input
                      type="text"
                      placeholder={`Deal name (auto-generated if empty)`}
                      className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors"
                      value={formData.deal_name || ''}
                      onChange={(e) => setFormData({...formData, deal_name: e.target.value})}
                    />
                  </div>
                </details>
                {/* Notes - Compact */}
                <div className="space-y-1">
                  <textarea
                    rows={2}
                    placeholder="Additional notes (optional)..."
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#37bd7e]/20 focus:border-[#37bd7e]/50 transition-colors resize-none"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="flex-1 py-2.5 px-4 bg-gray-800/30 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 py-2.5 px-4 text-white rounded-lg transition-all text-sm font-medium shadow-lg flex items-center justify-center gap-2",
                      submitStatus === 'success' 
                        ? "bg-green-600 hover:bg-green-700"
                        : isSubmitting
                          ? "bg-gray-600 cursor-not-allowed"
                          : "bg-gradient-to-r from-[#37bd7e] to-[#2da76c] hover:from-[#2da76c] hover:to-[#228b57]"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : submitStatus === 'success' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Created!
                      </>
                    ) : (
                      <>
                        Create {selectedAction === 'sale' ? 'Sale' : selectedAction === 'meeting' ? 'Meeting' : 'Proposal'}
                      </>
                    )}
                  </button>
                </div>
              </form>
              </motion.div>
            ) : null}
          </motion.div>
          
          {/* Deal Wizard Modal */}
          <DealWizard
            isOpen={showDealWizard}
            actionType={selectedAction as 'deal' | 'proposal' | 'sale' | 'meeting'}
            onClose={() => {
              setShowDealWizard(false);
              setSelectedAction(null);
              setSelectedContact(null);
              // Close the entire QuickAdd modal
              onClose();
            }}
            onDealCreated={(deal) => {
              setShowDealWizard(false);
              
              // For 'deal', 'proposal', or 'sale' action, reset and close properly
              if (selectedAction === 'deal' || selectedAction === 'proposal' || selectedAction === 'sale' || selectedAction === 'meeting') {
                // Reset everything back to initial state
                handleClose();
                // Don't show duplicate success toast - DealWizard already shows one
              } else {
                // Update the deal selector with the new deal if we're in a deal-related action
                if (selectedAction === 'meeting') {
                  setFormData(prev => ({
                    ...prev,
                    deal_id: deal.id,
                    selectedDeal: deal,
                    client_name: deal.company || prev.client_name
                  }));
                }
              }
            }}
            initialData={{
              clientName: formData.client_name || selectedContact?.company,
              contactEmail: selectedContact?.email || formData.contactIdentifier,
              contactName: selectedContact ? 
                           (selectedContact.full_name || 
                            (selectedContact.first_name || selectedContact.last_name ? 
                             `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() : 
                             selectedContact.email)) : 
                           formData.contact_name,
              dealValue: parseFloat(formData.amount) || 0,
              oneOffRevenue: parseFloat(formData.oneOffRevenue || '0') || 0,
              monthlyMrr: parseFloat(formData.monthlyMrr || '0') || 0,
              saleType: formData.saleType,
              companyWebsite: formData.company_website
            }}
          />
        </motion.div>
      )}

      {/* Contact Search Modal */}
      {showContactSearch && (
        <ContactSearchModal
          isOpen={showContactSearch}
          onClose={() => {
            setShowContactSearch(false);
            // Don't reset selectedAction here - let the contact selection handle it
          }}
          onContactSelect={(contact) => {
            // Pre-populate form data with contact info first
            const contactName = contact.full_name || 
                              (contact.first_name || contact.last_name ? 
                               `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
                               contact.email);
            
            // Extract company name from email domain if no company is set
            let companyName = '';
            let websiteUrl = '';
            
            // Check if contact has website info from form (newly created contact)
            if (contact._form_website || contact.company_website) {
              websiteUrl = contact._form_website || contact.company_website;
              // Extract company name from website if not provided
              if (!companyName && websiteUrl) {
                const cleanUrl = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
                const domain = cleanUrl.split('.')[0];
                companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
              }
            }
            
            // Check if contact has company information
            if (contact.company || contact.company_name) {
              companyName = contact.company || contact.company_name;
            } else if (contact.companies?.name) {
              companyName = contact.companies.name;
              if (!websiteUrl) {
                websiteUrl = contact.companies.website || '';
              }
            } else if (!companyName) {
              // Extract from email domain if available and no other info
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
            
            setFormData(prev => ({
              ...prev,
              contact_name: contactName,
              contactIdentifier: contact.email,
              contactIdentifierType: 'email',
              client_name: companyName || prev.client_name,
              company_website: websiteUrl || prev.company_website
            }));
            
            // Set the contact
            setSelectedContact(contact);
            
            // Close the modal after setting everything
            setShowContactSearch(false);
            
            // For Deal action, open DealWizard with the selected contact
            if (selectedAction === 'deal') {
              setTimeout(() => {
                setShowDealWizard(true);
              }, 100);
            }
          }}
        />
      )}

    </AnimatePresence>
  );
}