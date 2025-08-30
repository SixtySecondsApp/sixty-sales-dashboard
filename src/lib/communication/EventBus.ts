/**
 * Event-Driven Communication System
 * Provides loose coupling between components through event emission/subscription
 * Implements Observer pattern for component decoupling
 */

import React from 'react';

export type EventListener<T = any> = (data: T) => void | Promise<void>;

interface EventSubscription {
  id: string;
  listener: EventListener;
  once?: boolean;
}

/**
 * Type-safe event definitions for component communication
 */
export interface ComponentEvents {
  // Activity Events
  'activity:created': { type: string; id: string; clientName: string };
  'activity:updated': { id: string; changes: Record<string, any> };
  'activity:deleted': { id: string };

  // Deal Events  
  'deal:created': { id: string; name: string; stage: string };
  'deal:updated': { id: string; changes: Record<string, any> };
  'deal:stage-changed': { id: string; fromStage: string; toStage: string };
  'deal:deleted': { id: string };

  // Contact Events
  'contact:created': { id: string; name: string; email: string };
  'contact:updated': { id: string; changes: Record<string, any> };
  'contact:selected': { contact: any; context: string };

  // Task Events
  'task:created': { id: string; title: string; type: string };
  'task:updated': { id: string; changes: Record<string, any> };
  'task:completed': { id: string; completedAt: string };

  // Modal Events
  'modal:opened': { type: string; context?: any };
  'modal:closed': { type: string; result?: any };
  'modal:action': { type: string; action: string; data?: any };

  // Form Events
  'form:validated': { formId: string; isValid: boolean; errors: Record<string, string> };
  'form:submitted': { formId: string; data: any };
  'form:reset': { formId: string };

  // UI Events
  'ui:notification': { message: string; type: 'success' | 'error' | 'warning' | 'info' };
  'ui:loading': { component: string; loading: boolean };
  'ui:refresh': { component: string };

  // Business Logic Events
  'business:validation-required': { entity: string; data: any };
  'business:calculation-complete': { type: string; result: any };
  'business:workflow-step': { workflow: string; step: string; data?: any };
}

export type EventName = keyof ComponentEvents;
export type EventData<T extends EventName> = ComponentEvents[T];

/**
 * Centralized Event Bus for component communication
 * Implements Singleton and Observer patterns
 */
export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<EventName, Map<string, EventSubscription>>();
  private eventHistory: Array<{ event: EventName; data: any; timestamp: number }> = [];
  private maxHistorySize = 100;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to an event
   */
  on<T extends EventName>(
    eventName: T, 
    listener: EventListener<EventData<T>>,
    options?: { once?: boolean }
  ): () => void {
    const subscriptionId = this.generateId();
    
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Map());
    }

    const eventListeners = this.listeners.get(eventName)!;
    eventListeners.set(subscriptionId, {
      id: subscriptionId,
      listener: listener as EventListener,
      once: options?.once
    });

    // Return unsubscribe function
    return () => this.off(eventName, subscriptionId);
  }

  /**
   * Subscribe to an event once
   */
  once<T extends EventName>(
    eventName: T,
    listener: EventListener<EventData<T>>
  ): () => void {
    return this.on(eventName, listener, { once: true });
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends EventName>(eventName: T, subscriptionId?: string): void {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) return;

    if (subscriptionId) {
      eventListeners.delete(subscriptionId);
    } else {
      eventListeners.clear();
    }

    if (eventListeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<T extends EventName>(eventName: T, data: EventData<T>): Promise<void> {
    // Add to event history for debugging
    this.addToHistory(eventName, data);

    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) return;

    const toRemove: string[] = [];
    const promises: Promise<void>[] = [];

    for (const [subscriptionId, subscription] of eventListeners) {
      try {
        const result = subscription.listener(data);
        if (result instanceof Promise) {
          promises.push(result);
        }

        // Mark for removal if it's a once listener
        if (subscription.once) {
          toRemove.push(subscriptionId);
        }
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    }

    // Wait for all async listeners
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    // Remove once listeners
    toRemove.forEach(id => eventListeners.delete(id));
  }

  /**
   * Get current subscribers count for an event
   */
  getSubscriberCount(eventName: EventName): number {
    return this.listeners.get(eventName)?.size || 0;
  }

  /**
   * Get all active event subscriptions (for debugging)
   */
  getActiveSubscriptions(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [eventName, listeners] of this.listeners) {
      result[eventName] = listeners.size;
    }

    return result;
  }

  /**
   * Get recent event history (for debugging)
   */
  getEventHistory(limit = 20): Array<{ event: EventName; data: any; timestamp: number }> {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Clear all event listeners (for testing)
   */
  clear(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private addToHistory(eventName: EventName, data: any): void {
    this.eventHistory.push({
      event: eventName,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: Date.now()
    });

    // Keep history size manageable
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }
}

/**
 * Global event bus instance
 */
export const eventBus = EventBus.getInstance();

/**
 * React hook for event bus integration
 */
export function useEventBus() {
  return EventBus.getInstance();
}

/**
 * React hook for subscribing to specific events
 */
export function useEventListener<T extends EventName>(
  eventName: T,
  listener: EventListener<EventData<T>>,
  deps: React.DependencyList = []
) {
  const eventBusInstance = EventBus.getInstance();

  React.useEffect(() => {
    const unsubscribe = eventBusInstance.on(eventName, listener);
    return unsubscribe;
  }, deps);
}

/**
 * React hook for emitting events
 */
export function useEventEmitter() {
  const eventBusInstance = EventBus.getInstance();

  return React.useCallback(
    <T extends EventName>(eventName: T, data: EventData<T>) => {
      return eventBusInstance.emit(eventName, data);
    },
    [eventBusInstance]
  );
}

/**
 * Utility for conditional event emission
 */
export function emitIf<T extends EventName>(
  condition: boolean,
  eventName: T,
  data: EventData<T>
): Promise<void> {
  if (condition) {
    return eventBus.emit(eventName, data);
  }
  return Promise.resolve();
}

/**
 * Utility for event batching (emit multiple events in sequence)
 */
export async function emitBatch(events: Array<{ name: EventName; data: any }>): Promise<void> {
  for (const { name, data } of events) {
    await eventBus.emit(name as any, data);
  }
}

/**
 * Event middleware for logging and debugging
 */
export interface EventMiddleware {
  beforeEmit?<T extends EventName>(eventName: T, data: EventData<T>): void | Promise<void>;
  afterEmit?<T extends EventName>(eventName: T, data: EventData<T>): void | Promise<void>;
  onError?(error: Error, eventName: EventName, data: any): void;
}

class EventBusWithMiddleware extends EventBus {
  private middleware: EventMiddleware[] = [];

  addMiddleware(middleware: EventMiddleware): () => void {
    this.middleware.push(middleware);
    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index > -1) {
        this.middleware.splice(index, 1);
      }
    };
  }

  async emit<T extends EventName>(eventName: T, data: EventData<T>): Promise<void> {
    // Run before middleware
    for (const mw of this.middleware) {
      try {
        if (mw.beforeEmit) {
          await mw.beforeEmit(eventName, data);
        }
      } catch (error) {
        if (mw.onError) {
          mw.onError(error as Error, eventName, data);
        }
        console.error('Event middleware error (before):', error);
      }
    }

    try {
      await super.emit(eventName, data);

      // Run after middleware
      for (const mw of this.middleware) {
        try {
          if (mw.afterEmit) {
            await mw.afterEmit(eventName, data);
          }
        } catch (error) {
          if (mw.onError) {
            mw.onError(error as Error, eventName, data);
          }
          console.error('Event middleware error (after):', error);
        }
      }
    } catch (error) {
      for (const mw of this.middleware) {
        if (mw.onError) {
          mw.onError(error as Error, eventName, data);
        }
      }
      throw error;
    }
  }
}

/**
 * Enhanced event bus with middleware support
 */
export const enhancedEventBus = new EventBusWithMiddleware() as EventBusWithMiddleware & EventBus;

/**
 * Development utilities for debugging events
 */
export const eventDebugUtils = {
  /**
   * Log all events to console
   */
  enableEventLogging(): () => void {
    return enhancedEventBus.addMiddleware({
      beforeEmit: (eventName, data) => {
        console.log(`🔵 Event: ${eventName}`, data);
      }
    });
  },

  /**
   * Track event performance
   */
  enablePerformanceTracking(): () => void {
    const timings = new Map<string, number>();

    return enhancedEventBus.addMiddleware({
      beforeEmit: (eventName) => {
        timings.set(eventName, performance.now());
      },
      afterEmit: (eventName) => {
        const startTime = timings.get(eventName);
        if (startTime) {
          const duration = performance.now() - startTime;
          console.log(`⚡ Event ${eventName} took ${duration.toFixed(2)}ms`);
          timings.delete(eventName);
        }
      }
    });
  },

  /**
   * Get current event bus statistics
   */
  getStats() {
    return {
      activeSubscriptions: eventBus.getActiveSubscriptions(),
      recentEvents: eventBus.getEventHistory(10),
      totalEvents: eventBus.getEventHistory().length
    };
  }
};