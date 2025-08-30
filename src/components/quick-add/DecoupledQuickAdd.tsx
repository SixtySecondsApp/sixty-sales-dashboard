/**
 * Decoupled QuickAdd Component
 * Uses event-driven communication and service adapters for loose coupling
 * Implements interface abstractions and command patterns
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Decoupling imports
import { 
  useEventListener, 
  useEventEmitter,
  eventBus 
} from '@/lib/communication/EventBus';
import { 
  IFormComponent, 
  IModalComponent, 
  BaseComponent,
  ComponentEventHandler 
} from '@/lib/communication/ComponentInterfaces';
import { 
  getServiceAdapter,
  ActivityServiceAdapter,
  ContactServiceAdapter,
  TaskServiceAdapter,
  DealServiceAdapter,
  NotificationServiceAdapter,
  ValidationServiceAdapter
} from '@/lib/communication/ServiceAdapters';
import { 
  useFormState, 
  useModalState, 
  useComponentState, 
  useBusinessState 
} from '@/lib/communication/StateManagement';

// Existing component imports (for compatibility)
import { ActionGrid } from './ActionGrid';
import { TaskForm } from './TaskForm';
import { ActivityForms } from './ActivityForms';

interface DecoupledQuickAddProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Command pattern implementation for QuickAdd actions
 */
interface QuickAddCommand {
  execute(): Promise<void>;
  canExecute(): boolean;
  getDescription(): string;
}

class CreateTaskCommand implements QuickAddCommand {
  constructor(
    private taskData: any,
    private taskService: TaskServiceAdapter,
    private notificationService: NotificationServiceAdapter
  ) {}

  async execute(): Promise<void> {
    await this.taskService.execute('create', this.taskData);
    await this.notificationService.execute('success', { 
      message: 'Task created successfully!' 
    });
  }

  canExecute(): boolean {
    return !!(this.taskData.title && this.taskData.task_type);
  }

  getDescription(): string {
    return `Create task: ${this.taskData.title}`;
  }
}

class CreateActivityCommand implements QuickAddCommand {
  constructor(
    private activityData: any,
    private activityService: ActivityServiceAdapter,
    private notificationService: NotificationServiceAdapter
  ) {}

  async execute(): Promise<void> {
    await this.activityService.execute('create', this.activityData);
    await this.notificationService.execute('success', { 
      message: `${this.activityData.type} created successfully!` 
    });
  }

  canExecute(): boolean {
    return !!(this.activityData.type && this.activityData.client_name);
  }

  getDescription(): string {
    return `Create ${this.activityData.type}: ${this.activityData.client_name}`;
  }
}

/**
 * Service-based form validation
 */
class QuickAddFormValidator {
  constructor(private validationService: ValidationServiceAdapter) {}

  async validateTaskForm(data: any): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    return this.validationService.execute('validateForm', {
      formType: 'task',
      data
    });
  }

  async validateActivityForm(data: any): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    return this.validationService.execute('validateForm', {
      formType: 'activity', 
      data
    });
  }
}

/**
 * Business logic coordinator using event-driven patterns
 */
class QuickAddBusinessLogic extends BaseComponent {
  protected componentId = 'quick-add-business';

  constructor(
    private dealService: DealServiceAdapter,
    private contactService: ContactServiceAdapter
  ) {
    super();
  }

  async findOrCreateDeal(clientName: string, activityType: string): Promise<any> {
    try {
      // Check for existing deals
      const existingDeals = await this.dealService.execute('list', {
        filters: { company: clientName, stage: 'SQL' }
      });

      if (existingDeals.length > 0) {
        // Found existing deal - emit event for UI handling
        await this.emitComponentEvent('deal:updated', {
          id: existingDeals[0].id,
          changes: { last_activity: activityType }
        });
        return existingDeals[0];
      }

      // Create new deal
      const newDeal = await this.dealService.execute('create', {
        name: `${clientName} - ${activityType}`,
        company: clientName,
        stage_id: this.getStageIdForActivity(activityType)
      });

      return newDeal;
    } catch (error) {
      await this.emitComponentEvent('ui:notification', {
        message: `Failed to process deal: ${(error as Error).message}`,
        type: 'error'
      });
      throw error;
    }
  }

  private getStageIdForActivity(activityType: string): string {
    // Business logic for stage mapping
    const stageMap: Record<string, string> = {
      'meeting': '603b5020-aafc-4646-9195-9f041a9a3f14', // SQL
      'proposal': '8be6a854-e7d0-41b5-9057-03b2213e7697', // Opportunity
      'sale': '207a94db-abd8-43d8-ba21-411be66183d2' // Signed
    };
    
    return stageMap[activityType] || stageMap['meeting'];
  }
}

/**
 * Main QuickAdd component with decoupled architecture
 */
export function DecoupledQuickAdd({ isOpen, onClose }: DecoupledQuickAddProps) {
  // Service adapters - dependency injection pattern
  const taskService = getServiceAdapter<TaskServiceAdapter>('task');
  const activityService = getServiceAdapter<ActivityServiceAdapter>('activity');
  const contactService = getServiceAdapter<ContactServiceAdapter>('contact');
  const dealService = getServiceAdapter<DealServiceAdapter>('deal');
  const notificationService = getServiceAdapter<NotificationServiceAdapter>('notification');
  const validationService = getServiceAdapter<ValidationServiceAdapter>('validation');

  // Business logic coordinator
  const businessLogic = useRef(new QuickAddBusinessLogic(dealService, contactService));
  const formValidator = useRef(new QuickAddFormValidator(validationService));

  // Event-driven state management
  const quickAddForm = useFormState('quick-add');
  const contactSearchModal = useModalState('contact-search');
  const dealWizardModal = useModalState('deal-wizard');
  const componentState = useComponentState('quick-add');
  const businessState = useBusinessState();
  
  // Event emission for component communication
  const emit = useEventEmitter();

  // Local component state (minimized through decoupling)
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Command pattern for action handling
  const executeCommand = useCallback(async (command: QuickAddCommand) => {
    if (!command.canExecute()) {
      await emit('ui:notification', {
        message: 'Cannot execute command - validation failed',
        type: 'error'
      });
      return;
    }

    componentState.setLoading(true);
    try {
      await command.execute();
    } catch (error) {
      await emit('ui:notification', {
        message: `Command failed: ${(error as Error).message}`,
        type: 'error'
      });
    } finally {
      componentState.setLoading(false);
    }
  }, [emit, componentState]);

  // Event-driven form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation using service adapter
    let validation;
    if (selectedAction === 'task') {
      validation = await formValidator.current.validateTaskForm(quickAddForm.formData);
    } else {
      validation = await formValidator.current.validateActivityForm(quickAddForm.formData);
    }

    if (!validation.isValid) {
      quickAddForm.updateForm({ 
        validationErrors: validation.errors,
        submitStatus: 'error'
      });
      return;
    }

    // Create and execute command
    let command: QuickAddCommand;
    
    if (selectedAction === 'task') {
      command = new CreateTaskCommand(
        quickAddForm.formData,
        taskService,
        notificationService
      );
    } else {
      // Handle deal creation if needed
      if (['meeting', 'proposal', 'sale'].includes(selectedAction || '')) {
        const deal = await businessLogic.current.findOrCreateDeal(
          quickAddForm.formData.client_name,
          selectedAction || ''
        );
        quickAddForm.updateForm({ 
          formData: { 
            ...quickAddForm.formData, 
            deal_id: deal.id 
          } 
        });
      }

      command = new CreateActivityCommand(
        {
          ...quickAddForm.formData,
          type: selectedAction,
          date: selectedDate.toISOString()
        },
        activityService,
        notificationService
      );
    }

    await executeCommand(command);

    // Success handling through events
    setTimeout(() => {
      handleClose();
    }, 1000);
  }, [
    selectedAction, 
    quickAddForm, 
    selectedDate, 
    executeCommand, 
    taskService, 
    activityService, 
    notificationService
  ]);

  // Event-driven modal management
  const handleClose = useCallback(() => {
    setSelectedAction(null);
    setSelectedDate(new Date());
    quickAddForm.resetForm();
    businessState.setSelectedContact(null);
    componentState.resetComponent();
    onClose();
  }, [quickAddForm, businessState, componentState, onClose]);

  // Event-driven action selection
  const handleActionSelect = useCallback(async (actionId: string) => {
    setSelectedAction(actionId);
    
    // Emit action selection event
    await emit('modal:action', {
      type: 'quick-add',
      action: 'action-selected',
      data: { actionId }
    });

    // Open contact search for specific actions
    if (['deal', 'meeting', 'proposal', 'sale'].includes(actionId)) {
      contactSearchModal.openModal({ actionType: actionId });
    }
  }, [emit, contactSearchModal]);

  // Event listeners for cross-component communication
  useEventListener('contact:selected', ({ contact, context }) => {
    if (context === 'quick-add') {
      businessState.setSelectedContact(contact);
      contactSearchModal.closeModal(contact);
      
      // Auto-populate form data
      quickAddForm.updateForm({
        formData: {
          ...quickAddForm.formData,
          contact_name: contact.full_name || contact.email,
          contactIdentifier: contact.email,
          contactIdentifierType: 'email',
          client_name: contact.company || contact.companies?.name || ''
        }
      });
    }
  });

  useEventListener('deal:created', ({ id, name }) => {
    quickAddForm.updateForm({
      formData: {
        ...quickAddForm.formData,
        deal_id: id
      }
    });
  });

  // UI notification handling
  useEventListener('ui:notification', ({ message, type }) => {
    // This would typically integrate with your existing toast system
    // For now, we'll let the service adapter handle it
    console.log(`Notification [${type}]: ${message}`);
  });

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

            {/* Action Grid - Decoupled through event communication */}
            {!selectedAction && (
              <ActionGrid onActionSelect={handleActionSelect} />
            )}

            {/* Task Form - Uses decoupled state management */}
            {selectedAction === 'task' && (
              <TaskForm
                formData={quickAddForm.formData}
                setFormData={(data) => quickAddForm.updateForm({ formData: data })}
                validationErrors={quickAddForm.validationErrors}
                isSubmitting={componentState.isLoading}
                submitStatus={quickAddForm.submitStatus}
                onSubmit={handleSubmit}
                onBack={() => setSelectedAction(null)}
              />
            )}

            {/* Activity Forms - Uses decoupled communication */}
            {['meeting', 'proposal', 'sale'].includes(selectedAction || '') && 
             businessState.selectedContact && (
              <ActivityForms
                selectedAction={selectedAction}
                selectedContact={businessState.selectedContact}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                formData={quickAddForm.formData}
                setFormData={(data) => quickAddForm.updateForm({ formData: data })}
                validationErrors={quickAddForm.validationErrors}
                isSubmitting={componentState.isLoading}
                submitStatus={quickAddForm.submitStatus}
                onSubmit={handleSubmit}
                onBack={() => setSelectedAction(null)}
                onChangeContact={() => {
                  businessState.setSelectedContact(null);
                  contactSearchModal.openModal({ actionType: selectedAction });
                }}
              />
            )}

            {/* Loading State */}
            {componentState.isLoading && (
              <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Contact Search Modal - Event-driven communication */}
          {contactSearchModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full">
                <h3 className="text-lg font-semibold text-white mb-4">Select Contact</h3>
                <p className="text-gray-400 mb-6">
                  Choose a contact for this {contactSearchModal.modalData?.actionType || 'action'}.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Simulate contact selection for demo
                      const demoContact = {
                        id: '1',
                        email: 'demo@example.com',
                        full_name: 'Demo Contact',
                        company: 'Demo Company'
                      };
                      
                      emit('contact:selected', { 
                        contact: demoContact, 
                        context: 'quick-add' 
                      });
                    }}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    Select Demo Contact
                  </button>
                  <button
                    onClick={() => contactSearchModal.closeModal()}
                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}