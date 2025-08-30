/**
 * Component Communication Interfaces
 * Defines abstract interfaces for component interaction patterns
 * Implements Interface Segregation Principle for loose coupling
 */

import { EventName, EventData } from './EventBus';

/**
 * Base interface for all component communications
 */
export interface IComponentCommunication {
  /**
   * Notify other components of state changes
   */
  notify<T extends EventName>(event: T, data: EventData<T>): Promise<void>;

  /**
   * Subscribe to notifications from other components
   */
  subscribe<T extends EventName>(event: T, handler: (data: EventData<T>) => void): () => void;
}

/**
 * Interface for form-based components
 */
export interface IFormComponent extends IComponentCommunication {
  /**
   * Validate form data
   */
  validate(): Promise<{ isValid: boolean; errors: Record<string, string> }>;

  /**
   * Submit form data
   */
  submit(): Promise<void>;

  /**
   * Reset form to initial state
   */
  reset(): void;

  /**
   * Get current form data
   */
  getData(): Record<string, any>;

  /**
   * Update specific form fields
   */
  updateField(field: string, value: any): void;
}

/**
 * Interface for modal components
 */
export interface IModalComponent extends IComponentCommunication {
  /**
   * Open the modal with optional context
   */
  open(context?: any): void;

  /**
   * Close the modal with optional result
   */
  close(result?: any): void;

  /**
   * Check if modal is currently open
   */
  isOpen(): boolean;
}

/**
 * Interface for data-driven components
 */
export interface IDataComponent<T = any> extends IComponentCommunication {
  /**
   * Load data from source
   */
  loadData(): Promise<T[]>;

  /**
   * Refresh data from source
   */
  refreshData(): Promise<void>;

  /**
   * Get current data
   */
  getData(): T[];

  /**
   * Filter data based on criteria
   */
  filter(criteria: Record<string, any>): T[];

  /**
   * Sort data by field
   */
  sort(field: keyof T, direction: 'asc' | 'desc'): void;
}

/**
 * Interface for wizard/multi-step components
 */
export interface IWizardComponent extends IComponentCommunication {
  /**
   * Go to next step
   */
  nextStep(): Promise<boolean>;

  /**
   * Go to previous step
   */
  previousStep(): void;

  /**
   * Go to specific step
   */
  gotoStep(step: number): void;

  /**
   * Get current step index
   */
  getCurrentStep(): number;

  /**
   * Check if step is valid
   */
  isStepValid(step: number): boolean;

  /**
   * Complete the wizard
   */
  complete(): Promise<void>;

  /**
   * Cancel the wizard
   */
  cancel(): void;
}

/**
 * Interface for CRUD operations
 */
export interface ICrudOperations<T = any> extends IComponentCommunication {
  /**
   * Create new entity
   */
  create(data: Partial<T>): Promise<T>;

  /**
   * Read/fetch entity
   */
  read(id: string): Promise<T>;

  /**
   * Update existing entity
   */
  update(id: string, changes: Partial<T>): Promise<T>;

  /**
   * Delete entity
   */
  delete(id: string): Promise<void>;

  /**
   * List entities with optional filters
   */
  list(filters?: Record<string, any>): Promise<T[]>;
}

/**
 * Interface for validation operations
 */
export interface IValidationProvider {
  /**
   * Validate single field
   */
  validateField(field: string, value: any, context?: any): Promise<{ isValid: boolean; error?: string }>;

  /**
   * Validate entire object
   */
  validateObject(data: Record<string, any>, schema?: any): Promise<{ isValid: boolean; errors: Record<string, string> }>;

  /**
   * Get validation rules for field
   */
  getValidationRules(field: string): any;
}

/**
 * Interface for notification systems
 */
export interface INotificationProvider {
  /**
   * Show success notification
   */
  success(message: string, options?: { duration?: number; action?: any }): void;

  /**
   * Show error notification
   */
  error(message: string, options?: { duration?: number; action?: any }): void;

  /**
   * Show warning notification
   */
  warning(message: string, options?: { duration?: number; action?: any }): void;

  /**
   * Show info notification
   */
  info(message: string, options?: { duration?: number; action?: any }): void;

  /**
   * Clear all notifications
   */
  clear(): void;
}

/**
 * Interface for state management
 */
export interface IStateManager<T = any> {
  /**
   * Get current state
   */
  getState(): T;

  /**
   * Update state
   */
  setState(updates: Partial<T>): void;

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: T) => void): () => void;

  /**
   * Reset state to initial values
   */
  reset(): void;

  /**
   * Get state history (for undo/redo)
   */
  getHistory(): T[];
}

/**
 * Interface for service adapters
 */
export interface IServiceAdapter<T = any> {
  /**
   * Execute service operation
   */
  execute<R = any>(operation: string, params?: any): Promise<R>;

  /**
   * Check service health
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get service configuration
   */
  getConfig(): T;

  /**
   * Handle service errors
   */
  handleError(error: Error, operation: string): void;
}

/**
 * Interface for component mediator pattern
 */
export interface IComponentMediator {
  /**
   * Register component with mediator
   */
  register(componentId: string, component: IComponentCommunication): void;

  /**
   * Unregister component
   */
  unregister(componentId: string): void;

  /**
   * Send message between components
   */
  send(fromId: string, toId: string, message: any): Promise<void>;

  /**
   * Broadcast message to all components
   */
  broadcast(fromId: string, message: any): Promise<void>;

  /**
   * Get registered components
   */
  getComponents(): string[];
}

/**
 * Interface for command pattern implementation
 */
export interface ICommand {
  /**
   * Execute the command
   */
  execute(): Promise<void>;

  /**
   * Undo the command (if supported)
   */
  undo?(): Promise<void>;

  /**
   * Check if command can be executed
   */
  canExecute(): boolean;

  /**
   * Get command description
   */
  getDescription(): string;
}

/**
 * Interface for command handler
 */
export interface ICommandHandler {
  /**
   * Execute command
   */
  executeCommand(command: ICommand): Promise<void>;

  /**
   * Undo last command
   */
  undoLastCommand(): Promise<void>;

  /**
   * Get command history
   */
  getCommandHistory(): ICommand[];

  /**
   * Clear command history
   */
  clearHistory(): void;
}

/**
 * Interface for repository pattern
 */
export interface IComponentRepository<T = any> {
  /**
   * Find entities by criteria
   */
  findBy(criteria: Record<string, any>): Promise<T[]>;

  /**
   * Find single entity by ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Save entity
   */
  save(entity: T): Promise<T>;

  /**
   * Remove entity
   */
  remove(id: string): Promise<void>;

  /**
   * Count entities matching criteria
   */
  count(criteria?: Record<string, any>): Promise<number>;
}

/**
 * Type definitions for component communication
 */
export type ComponentEventHandler<T = any> = (data: T) => void | Promise<void>;
export type ComponentSubscription = () => void;
export type ValidationResult = { isValid: boolean; errors: Record<string, string> };
export type ServiceResult<T = any> = { success: boolean; data?: T; error?: string };

/**
 * Utility types for interface composition
 */
export type FormModalComponent = IFormComponent & IModalComponent;
export type DataCrudComponent<T> = IDataComponent<T> & ICrudOperations<T>;
export type WizardFormComponent = IWizardComponent & IFormComponent;

/**
 * Abstract base class for components using event-driven communication
 */
export abstract class BaseComponent implements IComponentCommunication {
  protected abstract componentId: string;

  async notify<T extends EventName>(event: T, data: EventData<T>): Promise<void> {
    const { eventBus } = await import('./EventBus');
    return eventBus.emit(event, data);
  }

  subscribe<T extends EventName>(event: T, handler: (data: EventData<T>) => void): () => void {
    const { eventBus } = require('./EventBus');
    return eventBus.on(event, handler);
  }

  protected emitComponentEvent<T extends EventName>(event: T, data: EventData<T>): Promise<void> {
    return this.notify(event, data);
  }

  protected subscribeToEvent<T extends EventName>(
    event: T, 
    handler: (data: EventData<T>) => void
  ): () => void {
    return this.subscribe(event, handler);
  }
}

/**
 * Decorator for adding event-driven capabilities to components
 */
export function withEventCommunication<T extends new (...args: any[]) => {}>(
  constructor: T
) {
  return class extends constructor implements IComponentCommunication {
    async notify<E extends EventName>(event: E, data: EventData<E>): Promise<void> {
      const { eventBus } = await import('./EventBus');
      return eventBus.emit(event, data);
    }

    subscribe<E extends EventName>(
      event: E, 
      handler: (data: EventData<E>) => void
    ): () => void {
      const { eventBus } = require('./EventBus');
      return eventBus.on(event, handler);
    }
  };
}

/**
 * Factory for creating component interfaces
 */
export class ComponentInterfaceFactory {
  static createFormInterface(componentId: string): IFormComponent {
    return new class extends BaseComponent implements IFormComponent {
      protected componentId = componentId;
      
      async validate(): Promise<ValidationResult> {
        // Implementation will be provided by concrete components
        throw new Error('validate() must be implemented by concrete component');
      }
      
      async submit(): Promise<void> {
        throw new Error('submit() must be implemented by concrete component');
      }
      
      reset(): void {
        throw new Error('reset() must be implemented by concrete component');
      }
      
      getData(): Record<string, any> {
        throw new Error('getData() must be implemented by concrete component');
      }
      
      updateField(field: string, value: any): void {
        throw new Error('updateField() must be implemented by concrete component');
      }
    }();
  }

  static createModalInterface(componentId: string): IModalComponent {
    return new class extends BaseComponent implements IModalComponent {
      protected componentId = componentId;
      private _isOpen = false;
      
      open(context?: any): void {
        this._isOpen = true;
        this.notify('modal:opened', { type: componentId, context });
      }
      
      close(result?: any): void {
        this._isOpen = false;
        this.notify('modal:closed', { type: componentId, result });
      }
      
      isOpen(): boolean {
        return this._isOpen;
      }
    }();
  }

  static createCrudInterface<T = any>(componentId: string): ICrudOperations<T> {
    return new class extends BaseComponent implements ICrudOperations<T> {
      protected componentId = componentId;
      
      async create(data: Partial<T>): Promise<T> {
        throw new Error('create() must be implemented by concrete component');
      }
      
      async read(id: string): Promise<T> {
        throw new Error('read() must be implemented by concrete component');
      }
      
      async update(id: string, changes: Partial<T>): Promise<T> {
        throw new Error('update() must be implemented by concrete component');
      }
      
      async delete(id: string): Promise<void> {
        throw new Error('delete() must be implemented by concrete component');
      }
      
      async list(filters?: Record<string, any>): Promise<T[]> {
        throw new Error('list() must be implemented by concrete component');
      }
    }();
  }
}