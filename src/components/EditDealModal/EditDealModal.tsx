import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Edit } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogFooter,
  DialogTitle,
  DialogDescription 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { EditDealProvider } from './contexts/EditDealContext';
import { useEditDeal } from './contexts/EditDealContext';
import SectionTabs from './components/SectionTabs';
import DealDetailsSection from './components/DealDetailsSection';
import PipelineStageSection from './components/PipelineStageSection';
import LeadSourceSection from './components/LeadSourceSection';
import ActivitySection from './components/ActivitySection';
import { useFocusTrap } from './utils/useFocusTrap';
import { usePipeline } from '@/lib/contexts/PipelineContext';
import { useForm, FormProvider } from 'react-hook-form';
import { useToast } from '../../../hooks/use-toast';
import { cn } from '@/lib/utils';
import { Deal } from '@/lib/database/models';

interface EditDealModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  deal: Partial<Deal>;
  onSave: (formData: Partial<Deal>) => Promise<void>;
  onDelete: (dealId: string) => Promise<void>;
}

// Helper function to get the badge class based on stage color
const getStageBadgeClass = (stageName: string, stageColor?: string) => {
  // If we have a stage color, use it for styling
  if (stageColor) {
    return `bg-opacity-15 border border-opacity-20 text-opacity-90` +
      ` style="background-color: ${stageColor}20; border-color: ${stageColor}40; color: ${stageColor}"`;
  }

  // Fallback to hard-coded colors if no stage color is provided
  const stageClasses: Record<string, string> = {
    'lead': 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    'discovery': 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
    'proposal': 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
    'negotiation': 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
    'closed won': 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    'closed lost': 'bg-red-500/15 text-red-400 border border-red-500/20'
  };
  return stageClasses[stageName.toLowerCase()] || 'bg-gray-500/15 text-gray-400 border border-gray-500/20';
};

/**
 * Accessible modal for editing deal information
 * 
 * Keyboard shortcuts:
 * - Tab: Navigate between focusable elements
 * - Shift+Tab: Navigate backward between focusable elements
 * - Escape: Close the modal
 * - Left/Right Arrow: Navigate between tabs when focus is on a tab
 * - Home: Go to first tab when focus is on a tab
 * - End: Go to last tab when focus is on a tab
 * - Space/Enter: Activate buttons, tabs, or stage options
 */
const EditDealModal: React.FC<EditDealModalProps> = ({ 
  open, 
  setOpen, 
  deal, 
  onSave, 
  onDelete 
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('details');
  const [currentStage, setCurrentStage] = useState('');
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Create a form instance
  const methods = useForm({
    defaultValues: {
      name: deal?.name || '',
      company: deal?.company || '',
      contactName: deal?.contact_name || '',
      amount: deal?.value || '',
      closeDate: deal?.expected_close_date || '',
      notes: deal?.notes || deal?.description || '',
      probability: deal?.probability || 20,
      nextAction: deal?.next_steps || '',
      dealSize: (deal as any)?.deal_size || '',
      priority: (deal as any)?.priority || '',
      leadSourceType: (deal as any)?.lead_source_type || '',
      leadSourceChannel: (deal as any)?.lead_source_channel || ''
    }
  });
  
  // Access pipeline stages from context
  const { stages } = usePipeline();
  
  // Refs for focus management
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  
  // Apply focus trap to modal
  useFocusTrap(dialogContentRef, open, initialFocusRef);

  // Set up initial stage when deal changes or when stages are loaded
  useEffect(() => {
    if (deal && stages && stages.length > 0) {
      const stageId = deal.stage_id || (deal as any).stage || '';
      setCurrentStage(stageId);
      
      // Find the stage name and color based on the ID
      const matchingStage = stages.find(s => s.id === stageId);
      if (matchingStage) {
        setStageName(matchingStage.name);
        setStageColor(matchingStage.color || '');
      } else {
        // Try to find by name if ID doesn't match
        const matchByName = stages.find(s => 
          s.name.toLowerCase() === stageId.toLowerCase()
        );
        if (matchByName) {
          setCurrentStage(matchByName.id);
          setStageName(matchByName.name);
          setStageColor(matchByName.color || '');
        } else {
          setStageName('Unknown');
          setStageColor('');
        }
      }
    }
  }, [deal, stages]);
  
  // Handle stage change
  const handleStageChange = (stageId: string) => {
    console.log("Stage changed to:", stageId);
    setCurrentStage(stageId);
    
    // Update stage name and color
    const matchingStage = stages.find(s => s.id === stageId);
    if (matchingStage) {
      setStageName(matchingStage.name);
      setStageColor(matchingStage.color || '');
    } else {
      setStageName('Unknown');
      setStageColor('');
    }
  };

  // Get stage name for display
  const getStageName = (stageId: string) => {
    // First try to find the stage in the pipeline context
    const stageFromContext = stages.find(s => s.id === stageId);
    if (stageFromContext) {
      return stageFromContext.name;
    }
    
    // Fallback to hard-coded values if not found
    const stageMap: Record<string, string> = {
      'lead': 'Lead',
      'discovery': 'Discovery',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed': 'Closed/Won'
    };
    return stageMap[stageId] || 'Unknown';
  };
  
  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  
  // Helper function to format date string to YYYY-MM-DD
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) return ''; 
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.error("Error formatting date:", e);
      return ''; // Return empty string on error
    }
  };

  // Handle save with form validation
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const formIsValid = await methods.trigger();
      if (!formIsValid) {
        const errors = methods.formState.errors;
        console.error("Form validation errors:", errors);
        toast({
          title: "Form Error",
          description: "Please fix the highlighted fields.",
          variant: "destructive"
        });
        setIsSaving(false);
        return;
      }
      
      const formData = methods.getValues();
      console.log(">>> DEBUG: Form data in handleSave:", formData);
      console.log(">>> DEBUG: Expected close date value:", formData.closeDate);
      
      // Ensure we're using a valid stage ID
      let stageId = currentStage;
      
      // Validate date format if provided
      let processedCloseDate = null;
      if (formData.closeDate && formData.closeDate.trim() !== '') {
        try {
          // Ensure the date is in proper format
          const dateObj = new Date(formData.closeDate);
          if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date format');
          }
          // Format as YYYY-MM-DD for database storage
          processedCloseDate = formData.closeDate;
          console.log(">>> DEBUG: Processed close date:", processedCloseDate);
        } catch (dateError) {
          console.error("Date validation error:", dateError);
          toast({
            title: "Invalid Date",
            description: "Please enter a valid expected close date.",
            variant: "destructive"
          });
          setIsSaving(false);
          return;
        }
      }
      
      // Map form field names to database column names
      const dataToSave = {
        name: formData.name,
        company: formData.company || null,
        value: formData.amount ? parseFloat(formData.amount as string) : null,
        // Try expected_close_date first, fallback to close_date if column doesn't exist
        expected_close_date: processedCloseDate,
        close_date: processedCloseDate, // Fallback field name
        description: formData.notes || null,
        stage_id: stageId,
        probability: formData.probability ? parseInt(formData.probability.toString()) : null,
        priority: formData.priority === '' ? null : formData.priority,
        next_steps: formData.nextAction, // Always include nextAction even if empty
        contact_name: formData.contactName || null,
        deal_size: formData.dealSize === '' ? null : formData.dealSize,
        lead_source_type: formData.leadSourceType === '' ? null : formData.leadSourceType,
        lead_source_channel: formData.leadSourceChannel === '' ? null : formData.leadSourceChannel
      };

      console.log(">>> DEBUG: dataToSave expected_close_date value:", dataToSave.expected_close_date);

      // Filter out null or undefined values, but keep expected_close_date and close_date for null values
      const cleanedData = Object.fromEntries(
        Object.entries(dataToSave).filter(([key, value]) => {
          // Always include date fields even if null (to clear the field)
          if (key === 'expected_close_date' || key === 'close_date') return true;
          return value !== null && value !== undefined;
        })
      );

      console.log("Saving deal with data:", cleanedData);
      await onSave(cleanedData);
      
      toast({
        title: "Deal Saved",
        description: "Deal has been successfully updated.",
        variant: "default",
      });
      
      setOpen(false);
    } catch (error) {
      console.error("Error saving deal:", error);
      toast({
        title: "Error Saving Deal",
        description: "There was a problem saving your changes.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle delete with confirmation
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this deal? This action cannot be undone.')) {
      try {
        setIsDeleting(true);
        await onDelete(deal.id || '');
        
        toast({
          title: "Deal Deleted",
          description: "Deal has been successfully deleted.",
          variant: "default",
        });
        
        setOpen(false);
      } catch (error) {
        console.error('Error deleting deal:', error);
        toast({
          title: "Error Deleting Deal",
          description: "There was a problem deleting this deal.",
          variant: "destructive"
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Reset active tab when modal opens
  useEffect(() => {
    if (open && deal) {
      // Calculate values first
      const nameValue = deal.name || '';
      const companyValue = deal.company || '';
      const contactNameValue = deal.contact_name || '';
      const amountValue = deal.value ?? '';
      const closeDateValue = formatDateForInput(deal.expected_close_date);
      const notesValue = deal.notes || deal.description || '';
      const probabilityValue = deal.probability ?? 0;
      const nextActionValue = deal.next_steps || '';
      const dealSizeValue = (deal as any)?.deal_size || '';
      const leadSourceTypeValue = (deal as any)?.lead_source_type || '';
      const leadSourceChannelValue = (deal as any)?.lead_source_channel || '';
      const priorityValue = (deal as any)?.priority || '';

      console.log('>>> DEBUG: Resetting form with deal:', deal);
      console.log('>>> DEBUG: Deal size value:', dealSizeValue);
      console.log('>>> DEBUG: Priority value:', priorityValue);

      const resetValues = {
        name: nameValue,
        company: companyValue,
        contactName: contactNameValue,
        amount: amountValue,
        closeDate: closeDateValue,
        notes: notesValue,
        probability: probabilityValue,
        nextAction: nextActionValue,
        dealSize: dealSizeValue,
        leadSourceType: leadSourceTypeValue,
        leadSourceChannel: leadSourceChannelValue,
        priority: priorityValue
      };

      methods.reset(resetValues);
      console.log('>>> DEBUG: Called methods.reset with:', resetValues);

      // *** Explicitly set values for all fields after reset ***
      const setValueOptions = { shouldValidate: false, shouldDirty: false };
      methods.setValue('name', nameValue, setValueOptions);
      methods.setValue('company', companyValue, setValueOptions);
      methods.setValue('contactName', contactNameValue, setValueOptions);
      methods.setValue('amount', amountValue, setValueOptions);
      methods.setValue('closeDate', closeDateValue, setValueOptions);
      methods.setValue('notes', notesValue, setValueOptions);
      methods.setValue('probability', probabilityValue, setValueOptions);
      methods.setValue('nextAction', nextActionValue, setValueOptions);
      methods.setValue('dealSize', dealSizeValue, setValueOptions);
      methods.setValue('leadSourceType', leadSourceTypeValue, setValueOptions);
      methods.setValue('leadSourceChannel', leadSourceChannelValue, setValueOptions);
      methods.setValue('priority', priorityValue, setValueOptions);
      console.log('>>> DEBUG: Explicitly called setValue for all fields.');

      // *** Log the form state AFTER setting values ***
      const currentFormValues = methods.getValues();
      console.log('>>> DEBUG: Form state values AFTER all setValue calls:', currentFormValues);

      // Focus the first interactive element after opening
      setTimeout(() => {
        if (initialFocusRef.current) {
          initialFocusRef.current.focus();
        }
      }, 100);
    }
  }, [open, deal, methods]);

  // Manage focus when switching tabs
  useEffect(() => {
    if (open && dialogContentRef.current && activeTab) {
      // Focus the first interactive element in the current tab section
      const currentTabSection = dialogContentRef.current.querySelector(`#${activeTab}-section`);
      if (currentTabSection) {
        const focusableElement = currentTabSection.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
        if (focusableElement) {
          focusableElement.focus();
        }
      }
    }
  }, [activeTab, open]);

  // Handle tab key navigation
  const handleTabKeyNavigation = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && e.shiftKey && document.activeElement === initialFocusRef.current) {
      e.preventDefault();
      if (deleteButtonRef.current) {
        deleteButtonRef.current.focus();
      }
    }
  };

  if (!deal) return null;

  return (
    <EditDealProvider deal={deal}>
      <FormProvider {...methods}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent 
            ref={dialogContentRef}
            className="max-w-[700px] p-0 overflow-hidden bg-gray-950 border border-gray-800 rounded-xl"
            onKeyDown={(e) => {
              handleKeyDown(e);
              handleTabKeyNavigation(e);
            }}
            id="edit-deal-modal-content"
          >
            <DialogHeader className="p-4 border-b border-gray-800 relative flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                  <Edit className="w-4 h-4" />
                </div>
                <DialogTitle className="text-xl font-semibold text-white">
                  {deal.name || (deal as any)?.dealName || "Edit Deal"}
                </DialogTitle>
                {currentStage && (
                  <div 
                    className={`px-3 py-1 text-sm font-medium rounded-md ml-2 ${getStageBadgeClass(stageName, stageColor)}`}
                    style={stageColor ? {
                      backgroundColor: `${stageColor}20`,
                      color: stageColor,
                      borderColor: `${stageColor}40`,
                      border: '1px solid'
                    } : {}}
                  >
                    {stageName}
                  </div>
                )}
              </div>
              
              <button
                ref={closeButtonRef}
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-opacity-50 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogHeader>

            <DialogDescription className="sr-only">
              Edit the details, pipeline stage, lead source and activities for this deal.
            </DialogDescription>

            <div 
              ref={tabsRef}
              className="border-b border-gray-800"
              role="tablist"
              aria-label="Deal sections"
            >
              <SectionTabs 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
              />
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-6" role="region" aria-live="polite" id={`${activeTab}-section`}>
              {activeTab === 'details' && <DealDetailsSection initialFocusRef={initialFocusRef} />}
              {activeTab === 'stage' && <PipelineStageSection onStageChange={handleStageChange} currentStage={currentStage} />}
              {activeTab === 'source' && <LeadSourceSection />}
              {activeTab === 'activity' && <ActivitySection dealId={deal.id} />}
            </div>
            
            <DialogFooter className="p-4 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
              <button
                ref={deleteButtonRef}
                onClick={handleDelete}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 
                  py-2 px-4 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-opacity-50"
                disabled={isDeleting}
                aria-label="Delete deal"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Deleting...' : 'Delete Deal'}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="py-2 px-4 rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700
                    transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-opacity-50"
                  aria-label="Cancel"
                >
                  Cancel
                </button>
                <button
                  ref={saveButtonRef}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 
                    text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors
                    focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-50
                    disabled:bg-violet-600/70 disabled:cursor-not-allowed"
                  aria-label="Save deal"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin mr-1">
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FormProvider>
    </EditDealProvider>
  );
};

export default EditDealModal; 