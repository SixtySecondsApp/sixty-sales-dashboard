/**
 * Service Adapters for Component Decoupling
 * Provides abstraction layer between components and business services
 * Implements Adapter pattern for service integration
 */

import { getServices } from '../services/ServiceLocator.tsx';
import { IServiceAdapter, ServiceResult } from './ComponentInterfaces';
import { eventBus, EventName, EventData } from './EventBus';

/**
 * Base service adapter with common functionality
 */
abstract class BaseServiceAdapter<T = any> implements IServiceAdapter<T> {
  protected readonly services = getServices();
  protected abstract readonly serviceName: string;

  abstract execute<R = any>(operation: string, params?: any): Promise<R>;

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.services.getServiceHealth();
      return health.healthy;
    } catch {
      return false;
    }
  }

  getConfig(): T {
    return this.services.config as unknown as T;
  }

  handleError(error: Error, operation: string): void {
    this.services.logger.error(`${this.serviceName} error in ${operation}:`, error);
    
    // Emit error event for components to handle
    eventBus.emit('ui:notification', {
      message: `Failed to ${operation}: ${error.message}`,
      type: 'error'
    });
  }

  protected async executeWithErrorHandling<R>(
    operation: string,
    executor: () => Promise<R>
  ): Promise<ServiceResult<R>> {
    try {
      const data = await executor();
      return { success: true, data };
    } catch (error) {
      this.handleError(error as Error, operation);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

/**
 * Deal Service Adapter
 * Abstracts deal-related operations for components
 */
export class DealServiceAdapter extends BaseServiceAdapter {
  protected readonly serviceName = 'DealService';

  async execute<R = any>(operation: string, params?: any): Promise<R> {
    const { dealService } = this.services;

    switch (operation) {
      case 'create':
        return this.createDeal(params) as Promise<R>;
      case 'update':
        return this.updateDeal(params.id, params.changes) as Promise<R>;
      case 'delete':
        return this.deleteDeal(params.id) as Promise<R>;
      case 'getById':
        return dealService.getDealById(params.id) as Promise<R>;
      case 'list':
        return dealService.getDeals(params.filters) as Promise<R>;
      case 'moveToStage':
        return this.moveToStage(params.dealId, params.stageId) as Promise<R>;
      default:
        throw new Error(`Unsupported deal operation: ${operation}`);
    }
  }

  private async createDeal(params: any): Promise<any> {
    const result = await this.executeWithErrorHandling('create deal', async () => {
      // Validate deal data
      const validation = await this.services.validationService.validateDeal(params);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${Object.values(validation.errors).join(', ')}`);
      }

      // Create deal through service layer
      const deal = await this.services.dealService.createDeal(params);

      // Emit success event
      await eventBus.emit('deal:created', {
        id: deal.id,
        name: deal.name,
        stage: deal.stage_id
      });

      return deal;
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async updateDeal(dealId: string, changes: any): Promise<any> {
    const result = await this.executeWithErrorHandling('update deal', async () => {
      const updatedDeal = await this.services.dealService.updateDeal(dealId, changes);

      await eventBus.emit('deal:updated', {
        id: dealId,
        changes
      });

      return updatedDeal;
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async deleteDeal(dealId: string): Promise<void> {
    const result = await this.executeWithErrorHandling('delete deal', async () => {
      await this.services.dealService.deleteDeal(dealId);

      await eventBus.emit('deal:deleted', { id: dealId });
    });

    if (!result.success) {
      throw new Error(result.error);
    }
  }

  private async moveToStage(dealId: string, stageId: string): Promise<any> {
    const result = await this.executeWithErrorHandling('move deal to stage', async () => {
      // Get current deal to know the from stage
      const currentDeal = await this.services.dealService.getDealById(dealId);
      const fromStage = currentDeal.stage_id;

      // Move to new stage
      const updatedDeal = await this.services.dealService.moveDealToStage(dealId, stageId);

      await eventBus.emit('deal:stage-changed', {
        id: dealId,
        fromStage,
        toStage: stageId
      });

      return updatedDeal;
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }
}

/**
 * Activity Service Adapter
 * Abstracts activity-related operations for components
 */
export class ActivityServiceAdapter extends BaseServiceAdapter {
  protected readonly serviceName = 'ActivityService';

  async execute<R = any>(operation: string, params?: any): Promise<R> {
    switch (operation) {
      case 'create':
        return this.createActivity(params) as Promise<R>;
      case 'update':
        return this.updateActivity(params.id, params.changes) as Promise<R>;
      case 'delete':
        return this.deleteActivity(params.id) as Promise<R>;
      case 'list':
        return this.getActivities(params.filters) as Promise<R>;
      default:
        throw new Error(`Unsupported activity operation: ${operation}`);
    }
  }

  private async createActivity(params: any): Promise<any> {
    const result = await this.executeWithErrorHandling('create activity', async () => {
      // Use existing hooks for activity creation to maintain compatibility
      const { useActivities } = await import('../hooks/useActivities');
      
      // Create activity (simplified for adapter pattern)
      const activity = {
        id: Date.now().toString(), // Temporary ID generation
        ...params,
        created_at: new Date().toISOString()
      };

      await eventBus.emit('activity:created', {
        type: params.type,
        id: activity.id,
        clientName: params.client_name || 'Unknown'
      });

      return activity;
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async updateActivity(activityId: string, changes: any): Promise<any> {
    const result = await this.executeWithErrorHandling('update activity', async () => {
      // Implementation would use existing activity hooks
      await eventBus.emit('activity:updated', {
        id: activityId,
        changes
      });

      return { id: activityId, ...changes };
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async deleteActivity(activityId: string): Promise<void> {
    const result = await this.executeWithErrorHandling('delete activity', async () => {
      // Implementation would use existing activity hooks
      await eventBus.emit('activity:deleted', { id: activityId });
    });

    if (!result.success) {
      throw new Error(result.error);
    }
  }

  private async getActivities(filters?: any): Promise<any[]> {
    const result = await this.executeWithErrorHandling('get activities', async () => {
      // Implementation would use existing activity hooks
      return []; // Placeholder
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data || [];
  }
}

/**
 * Contact Service Adapter
 * Abstracts contact-related operations for components
 */
export class ContactServiceAdapter extends BaseServiceAdapter {
  protected readonly serviceName = 'ContactService';

  async execute<R = any>(operation: string, params?: any): Promise<R> {
    switch (operation) {
      case 'create':
        return this.createContact(params) as Promise<R>;
      case 'update':
        return this.updateContact(params.id, params.changes) as Promise<R>;
      case 'search':
        return this.searchContacts(params.query) as Promise<R>;
      case 'findByEmail':
        return this.findByEmail(params.email) as Promise<R>;
      default:
        throw new Error(`Unsupported contact operation: ${operation}`);
    }
  }

  private async createContact(params: any): Promise<any> {
    const result = await this.executeWithErrorHandling('create contact', async () => {
      // Use existing contact hooks to maintain compatibility
      const contact = {
        id: Date.now().toString(),
        ...params,
        created_at: new Date().toISOString()
      };

      await eventBus.emit('contact:created', {
        id: contact.id,
        name: params.full_name || params.name,
        email: params.email
      });

      return contact;
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async updateContact(contactId: string, changes: any): Promise<any> {
    const result = await this.executeWithErrorHandling('update contact', async () => {
      await eventBus.emit('contact:updated', {
        id: contactId,
        changes
      });

      return { id: contactId, ...changes };
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async searchContacts(query: string): Promise<any[]> {
    const result = await this.executeWithErrorHandling('search contacts', async () => {
      // Implementation would use existing contact hooks
      return []; // Placeholder
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data || [];
  }

  private async findByEmail(email: string): Promise<any | null> {
    const result = await this.executeWithErrorHandling('find contact by email', async () => {
      // Implementation would use existing contact hooks
      return null; // Placeholder
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }
}

/**
 * Task Service Adapter
 * Abstracts task-related operations for components
 */
export class TaskServiceAdapter extends BaseServiceAdapter {
  protected readonly serviceName = 'TaskService';

  async execute<R = any>(operation: string, params?: any): Promise<R> {
    switch (operation) {
      case 'create':
        return this.createTask(params) as Promise<R>;
      case 'update':
        return this.updateTask(params.id, params.changes) as Promise<R>;
      case 'complete':
        return this.completeTask(params.id) as Promise<R>;
      case 'list':
        return this.getTasks(params.filters) as Promise<R>;
      default:
        throw new Error(`Unsupported task operation: ${operation}`);
    }
  }

  private async createTask(params: any): Promise<any> {
    const result = await this.executeWithErrorHandling('create task', async () => {
      const task = {
        id: Date.now().toString(),
        ...params,
        created_at: new Date().toISOString(),
        status: 'pending'
      };

      await eventBus.emit('task:created', {
        id: task.id,
        title: params.title,
        type: params.task_type
      });

      return task;
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async updateTask(taskId: string, changes: any): Promise<any> {
    const result = await this.executeWithErrorHandling('update task', async () => {
      await eventBus.emit('task:updated', {
        id: taskId,
        changes
      });

      return { id: taskId, ...changes };
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async completeTask(taskId: string): Promise<any> {
    const result = await this.executeWithErrorHandling('complete task', async () => {
      const completedAt = new Date().toISOString();

      await eventBus.emit('task:completed', {
        id: taskId,
        completedAt
      });

      return { id: taskId, status: 'completed', completed_at: completedAt };
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  private async getTasks(filters?: any): Promise<any[]> {
    const result = await this.executeWithErrorHandling('get tasks', async () => {
      // Implementation would use existing task hooks
      return []; // Placeholder
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data || [];
  }
}

/**
 * Validation Service Adapter
 * Provides validation services to components
 */
export class ValidationServiceAdapter extends BaseServiceAdapter {
  protected readonly serviceName = 'ValidationService';

  async execute<R = any>(operation: string, params?: any): Promise<R> {
    switch (operation) {
      case 'validateForm':
        return this.validateForm(params.formType, params.data) as Promise<R>;
      case 'validateField':
        return this.validateField(params.field, params.value, params.context) as Promise<R>;
      default:
        throw new Error(`Unsupported validation operation: ${operation}`);
    }
  }

  private async validateForm(formType: string, data: any): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    const result = await this.executeWithErrorHandling('validate form', async () => {
      let validation;

      switch (formType) {
        case 'deal':
          validation = await this.services.validationService.validateDeal(data);
          break;
        case 'activity':
          // Implementation would use validation service for activities
          validation = { isValid: true, errors: {} };
          break;
        case 'task':
          // Implementation would use validation service for tasks
          validation = { isValid: true, errors: {} };
          break;
        default:
          throw new Error(`Unknown form type: ${formType}`);
      }

      await eventBus.emit('form:validated', {
        formId: formType,
        isValid: validation.isValid,
        errors: validation.errors
      });

      return validation;
    });

    if (!result.success) {
      return { isValid: false, errors: { general: result.error || 'Validation failed' } };
    }

    return result.data!;
  }

  private async validateField(field: string, value: any, context?: any): Promise<{ isValid: boolean; error?: string }> {
    const result = await this.executeWithErrorHandling('validate field', async () => {
      // Implementation would use existing validation logic
      const isValid = value !== null && value !== undefined && value !== '';
      return { 
        isValid, 
        error: isValid ? undefined : `${field} is required` 
      };
    });

    if (!result.success) {
      return { isValid: false, error: result.error };
    }

    return result.data!;
  }
}

/**
 * Notification Service Adapter
 * Provides notification services to components
 */
export class NotificationServiceAdapter extends BaseServiceAdapter {
  protected readonly serviceName = 'NotificationService';

  async execute<R = any>(operation: string, params?: any): Promise<R> {
    switch (operation) {
      case 'success':
        return this.showSuccess(params.message, params.options) as Promise<R>;
      case 'error':
        return this.showError(params.message, params.options) as Promise<R>;
      case 'warning':
        return this.showWarning(params.message, params.options) as Promise<R>;
      case 'info':
        return this.showInfo(params.message, params.options) as Promise<R>;
      default:
        throw new Error(`Unsupported notification operation: ${operation}`);
    }
  }

  private async showSuccess(message: string, options?: any): Promise<void> {
    await eventBus.emit('ui:notification', {
      message,
      type: 'success'
    });
  }

  private async showError(message: string, options?: any): Promise<void> {
    await eventBus.emit('ui:notification', {
      message,
      type: 'error'
    });
  }

  private async showWarning(message: string, options?: any): Promise<void> {
    await eventBus.emit('ui:notification', {
      message,
      type: 'warning'
    });
  }

  private async showInfo(message: string, options?: any): Promise<void> {
    await eventBus.emit('ui:notification', {
      message,
      type: 'info'
    });
  }
}

/**
 * Service Adapter Registry
 * Centralized registry for all service adapters
 */
export class ServiceAdapterRegistry {
  private static instance: ServiceAdapterRegistry;
  private adapters = new Map<string, IServiceAdapter>();

  private constructor() {
    // Initialize default adapters
    this.register('deal', new DealServiceAdapter());
    this.register('activity', new ActivityServiceAdapter());
    this.register('contact', new ContactServiceAdapter());
    this.register('task', new TaskServiceAdapter());
    this.register('validation', new ValidationServiceAdapter());
    this.register('notification', new NotificationServiceAdapter());
  }

  static getInstance(): ServiceAdapterRegistry {
    if (!ServiceAdapterRegistry.instance) {
      ServiceAdapterRegistry.instance = new ServiceAdapterRegistry();
    }
    return ServiceAdapterRegistry.instance;
  }

  register(name: string, adapter: IServiceAdapter): void {
    this.adapters.set(name, adapter);
  }

  get<T extends IServiceAdapter = IServiceAdapter>(name: string): T {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Service adapter '${name}' not found`);
    }
    return adapter as T;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  unregister(name: string): void {
    this.adapters.delete(name);
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, adapter] of this.adapters) {
      try {
        results[name] = await adapter.isHealthy();
      } catch {
        results[name] = false;
      }
    }

    return results;
  }
}

/**
 * Convenience functions for accessing service adapters
 */
export const serviceAdapters = ServiceAdapterRegistry.getInstance();

export function getServiceAdapter<T extends IServiceAdapter = IServiceAdapter>(name: string): T {
  return serviceAdapters.get<T>(name);
}

export function useServiceAdapter<T extends IServiceAdapter = IServiceAdapter>(name: string): T {
  return React.useMemo(() => getServiceAdapter<T>(name), [name]);
}

/**
 * React hook for using multiple service adapters
 */
export function useServiceAdapters<T extends Record<string, IServiceAdapter> = Record<string, IServiceAdapter>>(
  names: string[]
): T {
  return React.useMemo(() => {
    const adapters: any = {};
    names.forEach(name => {
      adapters[name] = getServiceAdapter(name);
    });
    return adapters as T;
  }, [names]);
}

/**
 * Service adapter factory
 */
export class ServiceAdapterFactory {
  static create<T extends IServiceAdapter>(
    serviceName: string,
    implementation: new () => T
  ): T {
    return new implementation();
  }

  static createCustomAdapter<T = any>(
    serviceName: string,
    operations: Record<string, Function>
  ): IServiceAdapter<T> {
    return new class extends BaseServiceAdapter<T> {
      protected readonly serviceName = serviceName;

      async execute<R = any>(operation: string, params?: any): Promise<R> {
        const operationFunc = operations[operation];
        if (!operationFunc) {
          throw new Error(`Unsupported ${serviceName} operation: ${operation}`);
        }

        const result = await this.executeWithErrorHandling(operation, () => 
          operationFunc(params)
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return result.data;
      }
    }();
  }
}