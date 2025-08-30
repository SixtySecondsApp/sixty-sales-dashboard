/**
 * Event-Driven State Management Context
 * Provides decoupled state management through event-driven patterns
 * Implements Observer and Context patterns for loose coupling
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useEffect, 
  useCallback, 
  useMemo,
  ReactNode 
} from 'react';
import { eventBus, EventName, EventData, useEventListener, useEventEmitter } from './EventBus';
import { IStateManager } from './ComponentInterfaces';

/**
 * State interfaces for different domains
 */
export interface FormState {
  formData: Record<string, any>;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
}

export interface ModalState {
  activeModals: Set<string>;
  modalData: Record<string, any>;
  modalHistory: Array<{ type: string; timestamp: number }>;
}

export interface ComponentState {
  loadingStates: Record<string, boolean>;
  errorStates: Record<string, string | null>;
  selectedItems: Record<string, any>;
  filters: Record<string, any>;
}

export interface BusinessState {
  currentDeal: any | null;
  selectedContact: any | null;
  activeTask: any | null;
  workflowState: Record<string, any>;
}

/**
 * Combined application state
 */
export interface ApplicationState {
  forms: Record<string, FormState>;
  modals: ModalState;
  components: ComponentState;
  business: BusinessState;
}

/**
 * State action types
 */
type StateAction = 
  | { type: 'UPDATE_FORM'; payload: { formId: string; updates: Partial<FormState> } }
  | { type: 'RESET_FORM'; payload: { formId: string } }
  | { type: 'OPEN_MODAL'; payload: { modalType: string; data?: any } }
  | { type: 'CLOSE_MODAL'; payload: { modalType: string; result?: any } }
  | { type: 'SET_LOADING'; payload: { componentId: string; loading: boolean } }
  | { type: 'SET_ERROR'; payload: { componentId: string; error: string | null } }
  | { type: 'SELECT_ITEM'; payload: { componentId: string; item: any } }
  | { type: 'UPDATE_FILTER'; payload: { componentId: string; filter: Record<string, any> } }
  | { type: 'SET_BUSINESS_STATE'; payload: { key: keyof BusinessState; value: any } }
  | { type: 'RESET_COMPONENT_STATE'; payload: { componentId: string } }
  | { type: 'RESET_ALL_STATE' };

/**
 * Initial state
 */
const initialState: ApplicationState = {
  forms: {},
  modals: {
    activeModals: new Set(),
    modalData: {},
    modalHistory: []
  },
  components: {
    loadingStates: {},
    errorStates: {},
    selectedItems: {},
    filters: {}
  },
  business: {
    currentDeal: null,
    selectedContact: null,
    activeTask: null,
    workflowState: {}
  }
};

/**
 * State reducer with event-driven updates
 */
function stateReducer(state: ApplicationState, action: StateAction): ApplicationState {
  switch (action.type) {
    case 'UPDATE_FORM': {
      const { formId, updates } = action.payload;
      return {
        ...state,
        forms: {
          ...state.forms,
          [formId]: {
            ...state.forms[formId],
            ...updates
          }
        }
      };
    }

    case 'RESET_FORM': {
      const { formId } = action.payload;
      const newState = { ...state };
      delete newState.forms[formId];
      return newState;
    }

    case 'OPEN_MODAL': {
      const { modalType, data } = action.payload;
      return {
        ...state,
        modals: {
          ...state.modals,
          activeModals: new Set([...state.modals.activeModals, modalType]),
          modalData: {
            ...state.modals.modalData,
            [modalType]: data
          },
          modalHistory: [
            ...state.modals.modalHistory.slice(-19), // Keep last 20 entries
            { type: modalType, timestamp: Date.now() }
          ]
        }
      };
    }

    case 'CLOSE_MODAL': {
      const { modalType } = action.payload;
      const newActiveModals = new Set(state.modals.activeModals);
      newActiveModals.delete(modalType);
      
      const newModalData = { ...state.modals.modalData };
      delete newModalData[modalType];

      return {
        ...state,
        modals: {
          ...state.modals,
          activeModals: newActiveModals,
          modalData: newModalData
        }
      };
    }

    case 'SET_LOADING': {
      const { componentId, loading } = action.payload;
      return {
        ...state,
        components: {
          ...state.components,
          loadingStates: {
            ...state.components.loadingStates,
            [componentId]: loading
          }
        }
      };
    }

    case 'SET_ERROR': {
      const { componentId, error } = action.payload;
      return {
        ...state,
        components: {
          ...state.components,
          errorStates: {
            ...state.components.errorStates,
            [componentId]: error
          }
        }
      };
    }

    case 'SELECT_ITEM': {
      const { componentId, item } = action.payload;
      return {
        ...state,
        components: {
          ...state.components,
          selectedItems: {
            ...state.components.selectedItems,
            [componentId]: item
          }
        }
      };
    }

    case 'UPDATE_FILTER': {
      const { componentId, filter } = action.payload;
      return {
        ...state,
        components: {
          ...state.components,
          filters: {
            ...state.components.filters,
            [componentId]: {
              ...state.components.filters[componentId],
              ...filter
            }
          }
        }
      };
    }

    case 'SET_BUSINESS_STATE': {
      const { key, value } = action.payload;
      return {
        ...state,
        business: {
          ...state.business,
          [key]: value
        }
      };
    }

    case 'RESET_COMPONENT_STATE': {
      const { componentId } = action.payload;
      const newComponents = { ...state.components };
      delete newComponents.loadingStates[componentId];
      delete newComponents.errorStates[componentId];
      delete newComponents.selectedItems[componentId];
      delete newComponents.filters[componentId];

      return {
        ...state,
        components: newComponents
      };
    }

    case 'RESET_ALL_STATE':
      return initialState;

    default:
      return state;
  }
}

/**
 * State context and dispatch context
 */
const StateContext = createContext<ApplicationState>(initialState);
const DispatchContext = createContext<React.Dispatch<StateAction> | null>(null);

/**
 * State provider with event-driven integration
 */
export function StateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(stateReducer, initialState);

  // Event listeners for automatic state updates
  useEventListener('form:validated', ({ formId, isValid, errors }) => {
    dispatch({
      type: 'UPDATE_FORM',
      payload: {
        formId,
        updates: {
          validationErrors: errors,
          submitStatus: isValid ? 'idle' : 'error'
        }
      }
    });
  });

  useEventListener('form:submitted', ({ formId }) => {
    dispatch({
      type: 'UPDATE_FORM',
      payload: {
        formId,
        updates: {
          isSubmitting: true,
          submitStatus: 'idle'
        }
      }
    });
  });

  useEventListener('modal:opened', ({ type: modalType, context }) => {
    dispatch({
      type: 'OPEN_MODAL',
      payload: { modalType, data: context }
    });
  });

  useEventListener('modal:closed', ({ type: modalType, result }) => {
    dispatch({
      type: 'CLOSE_MODAL',
      payload: { modalType, result }
    });
  });

  useEventListener('ui:loading', ({ component, loading }) => {
    dispatch({
      type: 'SET_LOADING',
      payload: { componentId: component, loading }
    });
  });

  useEventListener('contact:selected', ({ contact, context }) => {
    dispatch({
      type: 'SET_BUSINESS_STATE',
      payload: { key: 'selectedContact', value: contact }
    });
  });

  useEventListener('deal:created', ({ id, name }) => {
    dispatch({
      type: 'SET_BUSINESS_STATE',
      payload: { key: 'currentDeal', value: { id, name } }
    });
  });

  // Provide state and dispatch through context
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

/**
 * Hook to access application state
 */
export function useApplicationState(): ApplicationState {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useApplicationState must be used within StateProvider');
  }
  return context;
}

/**
 * Hook to access dispatch function
 */
export function useStateDispatch(): React.Dispatch<StateAction> {
  const context = useContext(DispatchContext);
  if (!context) {
    throw new Error('useStateDispatch must be used within StateProvider');
  }
  return context;
}

/**
 * Specialized hooks for different state domains
 */
export function useFormState(formId: string) {
  const state = useApplicationState();
  const dispatch = useStateDispatch();
  const emit = useEventEmitter();

  const formState = state.forms[formId] || {
    formData: {},
    validationErrors: {},
    isSubmitting: false,
    submitStatus: 'idle' as const
  };

  const updateForm = useCallback((updates: Partial<FormState>) => {
    dispatch({
      type: 'UPDATE_FORM',
      payload: { formId, updates }
    });
  }, [formId, dispatch]);

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM', payload: { formId } });
    emit('form:reset', { formId });
  }, [formId, dispatch, emit]);

  const submitForm = useCallback(async (data: any) => {
    updateForm({ isSubmitting: true });
    await emit('form:submitted', { formId, data });
    updateForm({ isSubmitting: false, submitStatus: 'success' });
  }, [formId, updateForm, emit]);

  return {
    ...formState,
    updateForm,
    resetForm,
    submitForm
  };
}

export function useModalState(modalType: string) {
  const state = useApplicationState();
  const dispatch = useStateDispatch();
  const emit = useEventEmitter();

  const isOpen = state.modals.activeModals.has(modalType);
  const modalData = state.modals.modalData[modalType];

  const openModal = useCallback((data?: any) => {
    dispatch({
      type: 'OPEN_MODAL',
      payload: { modalType, data }
    });
    emit('modal:opened', { type: modalType, context: data });
  }, [modalType, dispatch, emit]);

  const closeModal = useCallback((result?: any) => {
    dispatch({
      type: 'CLOSE_MODAL',
      payload: { modalType, result }
    });
    emit('modal:closed', { type: modalType, result });
  }, [modalType, dispatch, emit]);

  return {
    isOpen,
    modalData,
    openModal,
    closeModal
  };
}

export function useComponentState(componentId: string) {
  const state = useApplicationState();
  const dispatch = useStateDispatch();
  const emit = useEventEmitter();

  const componentState = {
    isLoading: state.components.loadingStates[componentId] || false,
    error: state.components.errorStates[componentId] || null,
    selectedItem: state.components.selectedItems[componentId] || null,
    filters: state.components.filters[componentId] || {}
  };

  const setLoading = useCallback((loading: boolean) => {
    dispatch({
      type: 'SET_LOADING',
      payload: { componentId, loading }
    });
    emit('ui:loading', { component: componentId, loading });
  }, [componentId, dispatch, emit]);

  const setError = useCallback((error: string | null) => {
    dispatch({
      type: 'SET_ERROR',
      payload: { componentId, error }
    });
  }, [componentId, dispatch]);

  const selectItem = useCallback((item: any) => {
    dispatch({
      type: 'SELECT_ITEM',
      payload: { componentId, item }
    });
  }, [componentId, dispatch]);

  const updateFilters = useCallback((filter: Record<string, any>) => {
    dispatch({
      type: 'UPDATE_FILTER',
      payload: { componentId, filter }
    });
  }, [componentId, dispatch]);

  const resetComponent = useCallback(() => {
    dispatch({
      type: 'RESET_COMPONENT_STATE',
      payload: { componentId }
    });
  }, [componentId, dispatch]);

  return {
    ...componentState,
    setLoading,
    setError,
    selectItem,
    updateFilters,
    resetComponent
  };
}

export function useBusinessState() {
  const state = useApplicationState();
  const dispatch = useStateDispatch();
  const emit = useEventEmitter();

  const setBusinessState = useCallback((key: keyof BusinessState, value: any) => {
    dispatch({
      type: 'SET_BUSINESS_STATE',
      payload: { key, value }
    });
  }, [dispatch]);

  const setCurrentDeal = useCallback((deal: any) => {
    setBusinessState('currentDeal', deal);
    if (deal) {
      emit('deal:created', { id: deal.id, name: deal.name, stage: deal.stage });
    }
  }, [setBusinessState, emit]);

  const setSelectedContact = useCallback((contact: any) => {
    setBusinessState('selectedContact', contact);
    if (contact) {
      emit('contact:selected', { contact, context: 'business-state' });
    }
  }, [setBusinessState, emit]);

  const setActiveTask = useCallback((task: any) => {
    setBusinessState('activeTask', task);
    if (task) {
      emit('task:created', { id: task.id, title: task.title, type: task.type });
    }
  }, [setBusinessState, emit]);

  return {
    ...state.business,
    setCurrentDeal,
    setSelectedContact,
    setActiveTask,
    setBusinessState
  };
}

/**
 * Custom state manager implementation
 */
export class EventDrivenStateManager<T = any> implements IStateManager<T> {
  private state: T;
  private subscribers: Array<(state: T) => void> = [];
  private history: T[] = [];
  private maxHistorySize: number = 50;

  constructor(private initialState: T, private stateId?: string) {
    this.state = initialState;
    this.history.push(JSON.parse(JSON.stringify(initialState)));
  }

  getState(): T {
    return this.state;
  }

  setState(updates: Partial<T>): void {
    const newState = { ...this.state, ...updates };
    
    // Add to history
    this.history.push(JSON.parse(JSON.stringify(newState)));
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    this.state = newState;
    
    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });

    // Emit event if state ID is provided
    if (this.stateId) {
      eventBus.emit('business:workflow-step', {
        workflow: this.stateId,
        step: 'state-updated',
        data: updates
      });
    }
  }

  subscribe(callback: (state: T) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  reset(): void {
    this.setState(this.initialState as Partial<T>);
  }

  getHistory(): T[] {
    return [...this.history];
  }

  undo(): boolean {
    if (this.history.length > 1) {
      this.history.pop(); // Remove current state
      const previousState = this.history[this.history.length - 1];
      this.state = previousState;
      
      // Notify subscribers without adding to history
      this.subscribers.forEach(callback => {
        try {
          callback(this.state);
        } catch (error) {
          console.error('Error in state subscriber:', error);
        }
      });
      
      return true;
    }
    return false;
  }
}

/**
 * Hook for using event-driven state manager
 */
export function useEventDrivenState<T>(
  initialState: T, 
  stateId?: string
): [T, (updates: Partial<T>) => void, EventDrivenStateManager<T>] {
  const manager = useMemo(
    () => new EventDrivenStateManager(initialState, stateId),
    [initialState, stateId]
  );

  const [state, setState] = React.useState<T>(initialState);

  useEffect(() => {
    return manager.subscribe(setState);
  }, [manager]);

  const updateState = useCallback((updates: Partial<T>) => {
    manager.setState(updates);
  }, [manager]);

  return [state, updateState, manager];
}

/**
 * State synchronization utilities
 */
export const stateSyncUtils = {
  /**
   * Sync component state with event bus
   */
  syncComponentState<T>(
    componentId: string,
    state: T,
    onChange: (newState: T) => void
  ): () => void {
    const unsubscribe = eventBus.on('ui:refresh', ({ component }) => {
      if (component === componentId || component === 'all') {
        // Trigger refresh for this component
        onChange({ ...state });
      }
    });

    return unsubscribe;
  },

  /**
   * Create bidirectional state sync
   */
  createBidirectionalSync<T>(
    localState: [T, (state: T) => void],
    globalStateKey: string
  ): () => void {
    const [state, setState] = localState;

    // Listen for global state changes
    const unsubscribe = eventBus.on('business:workflow-step', ({ workflow, data }) => {
      if (workflow === globalStateKey) {
        setState({ ...state, ...data });
      }
    });

    return unsubscribe;
  },

  /**
   * Batch state updates to reduce re-renders
   */
  batchStateUpdates(updates: Array<() => void>): void {
    React.unstable_batchedUpdates(() => {
      updates.forEach(update => update());
    });
  }
};