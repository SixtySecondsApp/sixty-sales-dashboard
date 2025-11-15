/**
 * Communication Layer Index
 * Central export point for all decoupling abstractions
 * Provides unified access to event-driven communication system
 */

// Event-driven communication
export {
  EventBus,
  eventBus,
  enhancedEventBus,
  useEventBus,
  useEventListener,
  useEventEmitter,
  emitIf,
  emitBatch,
  eventDebugUtils
} from './EventBus';

export type {
  EventListener,
  ComponentEvents,
  EventName,
  EventData,
  EventMiddleware
} from './EventBus';

// Component interfaces and abstractions
export {
  BaseComponent,
  withEventCommunication,
  ComponentInterfaceFactory
} from './ComponentInterfaces';

export type {
  IComponentCommunication,
  IFormComponent,
  IModalComponent,
  IDataComponent,
  IWizardComponent,
  ICrudOperations,
  IValidationProvider,
  INotificationProvider,
  IStateManager,
  IServiceAdapter,
  IComponentMediator,
  ICommand,
  ICommandHandler,
  IComponentRepository,
  ComponentEventHandler,
  ComponentSubscription,
  ValidationResult,
  ServiceResult,
  FormModalComponent,
  DataCrudComponent,
  WizardFormComponent
} from './ComponentInterfaces';

// Service adapters
export {
  DealServiceAdapter,
  ActivityServiceAdapter,
  ContactServiceAdapter,
  TaskServiceAdapter,
  ValidationServiceAdapter,
  NotificationServiceAdapter,
  ServiceAdapterRegistry,
  serviceAdapters,
  getServiceAdapter,
  useServiceAdapter,
  useServiceAdapters,
  ServiceAdapterFactory
} from './ServiceAdapters';

// State management
export {
  StateProvider,
  useApplicationState,
  useStateDispatch,
  useFormState,
  useModalState,
  useComponentState,
  useBusinessState,
  EventDrivenStateManager,
  useEventDrivenState,
  stateSyncUtils
} from './StateManagement';

export type {
  FormState,
  ModalState,
  ComponentState,
  BusinessState,
  ApplicationState
} from './StateManagement';

// Component mediator
export {
  ComponentMediator,
  componentMediator,
  registerComponent,
  sendComponentMessage,
  broadcastMessage,
  useComponentMediator,
  withComponentMediator,
  mediatorUtils
} from './ComponentMediator.tsx';

/**
 * Quick setup function for new projects
 */
export function initializeCommunicationLayer(): Promise<void> {
  return new Promise((resolve) => {
    // Initialize service adapters
    const registry = ServiceAdapterRegistry.getInstance();
    // Initialize mediator
    const mediator = ComponentMediator.getInstance();
    // Setup event debugging in development
    if (process.env.NODE_ENV === 'development') {
      eventDebugUtils.enableEventLogging();
    }
    resolve();
  });
}

/**
 * Health check for communication layer
 */
export async function checkCommunicationHealth(): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
  components: number;
  events: number;
}> {
  try {
    // Check service adapters
    const services = await serviceAdapters.healthCheck();
    
    // Check mediator stats
    const mediatorStats = componentMediator.getMediationStats();
    
    // Check event bus stats
    const eventStats = eventDebugUtils.getStats();

    const allServicesHealthy = Object.values(services).every(Boolean);

    return {
      healthy: allServicesHealthy,
      services,
      components: mediatorStats.componentsRegistered,
      events: eventStats.totalEvents
    };
  } catch (error) {
    return {
      healthy: false,
      services: {},
      components: 0,
      events: 0
    };
  }
}

/**
 * Development utilities
 */
export const communicationDevUtils = {
  /**
   * Get complete system overview
   */
  getSystemOverview() {
    return {
      eventBus: eventDebugUtils.getStats(),
      mediator: mediatorUtils.getStats(),
      serviceAdapters: serviceAdapters.list()
    };
  },

  /**
   * Enable comprehensive debugging
   */
  enableFullDebugging(): () => void {
    const eventUnsubscribe = eventDebugUtils.enableEventLogging();
    const performanceUnsubscribe = eventDebugUtils.enablePerformanceTracking();
    const tracingUnsubscribe = mediatorUtils.enableTracing();

    return () => {
      eventUnsubscribe();
      performanceUnsubscribe();
      tracingUnsubscribe();
    };
  },

  /**
   * Test communication patterns
   */
  async testCommunicationPatterns(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test event emission
    try {
      await eventBus.emit('ui:notification', { message: 'Test', type: 'info' });
      results.eventEmission = true;
    } catch {
      results.eventEmission = false;
    }

    // Test service adapters
    try {
      const dealService = getServiceAdapter('deal');
      results.serviceAdapters = await dealService.isHealthy();
    } catch {
      results.serviceAdapters = false;
    }

    // Test mediator
    try {
      const stats = mediatorUtils.getStats();
      results.mediator = stats.componentsRegistered >= 0;
    } catch {
      results.mediator = false;
    }

    return results;
  }
};

/**
 * Migration utilities for existing components
 */
export const migrationUtils = {
  /**
   * Wrap existing component with event communication
   */
  addEventCommunication<T extends React.ComponentType<any>>(
    Component: T,
    componentId: string
  ): T {
    return withEventCommunication(Component) as T;
  },

  /**
   * Create service adapter for existing hooks
   */
  adaptExistingHook(hookName: string, hookFunction: Function) {
    return ServiceAdapterFactory.createCustomAdapter(
      hookName,
      {
        execute: hookFunction
      }
    );
  },

  /**
   * Convert prop drilling to event-driven communication
   */
  convertPropDrilling(
    parentComponentId: string,
    childComponentId: string,
    propName: string
  ): {
    emitProp: (value: any) => Promise<void>;
    subscribeToProp: (handler: (value: any) => void) => () => void;
  } {
    return {
      emitProp: async (value: any) => {
        await eventBus.emit('ui:notification', {
          message: `${propName} updated`,
          type: 'info'
        });
        
        await sendComponentMessage(parentComponentId, childComponentId, {
          type: 'prop-update',
          propName,
          value
        });
      },
      subscribeToProp: (handler: (value: any) => void) => {
        return eventBus.on('ui:notification', (data) => {
          if (data.message.includes(`${propName} updated`)) {
            // This is a simplified example - in practice, you'd have more sophisticated routing
            handler(data);
          }
        });
      }
    };
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceUtils = {
  /**
   * Measure communication overhead
   */
  async measureCommunicationOverhead(): Promise<{
    directCall: number;
    eventDriven: number;
    serviceAdapter: number;
    overhead: Record<string, number>;
  }> {
    const measurements = {
      directCall: 0,
      eventDriven: 0,
      serviceAdapter: 0,
      overhead: {} as Record<string, number>
    };

    // Measure direct function call
    const start1 = performance.now();
    const testFunction = () => Promise.resolve('test');
    await testFunction();
    measurements.directCall = performance.now() - start1;

    // Measure event-driven call
    const start2 = performance.now();
    await eventBus.emit('ui:notification', { message: 'test', type: 'info' });
    measurements.eventDriven = performance.now() - start2;

    // Measure service adapter call
    const start3 = performance.now();
    try {
      const adapter = getServiceAdapter('notification');
      await adapter.execute('info', { message: 'test' });
    } catch {
      // Service might not be fully initialized
    }
    measurements.serviceAdapter = performance.now() - start3;

    // Calculate overhead percentages
    measurements.overhead.eventDriven = 
      ((measurements.eventDriven - measurements.directCall) / measurements.directCall) * 100;
    measurements.overhead.serviceAdapter = 
      ((measurements.serviceAdapter - measurements.directCall) / measurements.directCall) * 100;

    return measurements;
  },

  /**
   * Monitor coupling reduction metrics
   */
  getCouplingMetrics(): {
    componentCount: number;
    directDependencies: number;
    eventDependencies: number;
    couplingScore: number;
  } {
    const stats = mediatorUtils.getStats();
    const componentCount = stats.componentsRegistered;
    
    // Estimate coupling reduction based on communication patterns
    // This is a simplified calculation - in practice, you'd use static analysis
    const directDependencies = 0; // Would be calculated from actual component analysis
    const eventDependencies = stats.rulesActive;
    
    const couplingScore = directDependencies / Math.max(componentCount * (componentCount - 1) / 2, 1);

    return {
      componentCount,
      directDependencies,
      eventDependencies,
      couplingScore
    };
  }
};