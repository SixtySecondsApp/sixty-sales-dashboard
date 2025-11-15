/**
 * Copilot Context Provider
 * Manages global state for AI Copilot feature
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CopilotService } from '@/lib/services/copilotService';
import type {
  CopilotMessage,
  CopilotState,
  CopilotContext as CopilotContextType,
  Recommendation,
  ToolCall,
  ToolType
} from '@/components/copilot/types';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

interface CopilotContextValue {
  isOpen: boolean;
  openCopilot: (initialQuery?: string) => void;
  closeCopilot: () => void;
  sendMessage: (message: string) => Promise<void>;
  messages: CopilotMessage[];
  isLoading: boolean;
  context: CopilotContextType;
  setContext: (context: Partial<CopilotContextType>) => void;
}

const CopilotContext = createContext<CopilotContextValue | undefined>(undefined);

export const useCopilot = () => {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within CopilotProvider');
  }
  return context;
};

interface CopilotProviderProps {
  children: ReactNode;
}

export const CopilotProvider: React.FC<CopilotProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<CopilotState>({
    mode: 'empty',
    messages: [],
    isLoading: false,
    currentInput: '',
    conversationId: undefined
  });
  const [context, setContextState] = useState<CopilotContextType>({
    userId: '',
    currentView: 'dashboard'
  });

  // Initialize user context
  React.useEffect(() => {
    const initContext = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session?.user) {
        setContextState(prev => ({
          ...prev,
          userId: session.user.id
        }));
      }
    };
    initContext();
  }, []);

  const openCopilot = useCallback((initialQuery?: string) => {
    setIsOpen(true);
    if (initialQuery) {
      setState(prev => ({
        ...prev,
        currentInput: initialQuery,
        mode: 'active'
      }));
      // Auto-send if query provided
      setTimeout(() => {
        sendMessage(initialQuery);
      }, 100);
    } else {
      setState(prev => ({
        ...prev,
        mode: prev.messages.length > 0 ? 'active' : 'empty'
      }));
    }
  }, []);

  const closeCopilot = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setContext = useCallback((newContext: Partial<CopilotContextType>) => {
    setContextState(prev => ({ ...prev, ...newContext }));
  }, []);

  // Helper function to detect intent and determine tool type
  const detectToolType = useCallback((message: string): ToolType | null => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('pipeline') || lowerMessage.includes('deal') || lowerMessage.includes('priority') || lowerMessage.includes('prioritize') || lowerMessage.includes('attention')) {
      return 'pipeline_data';
    }
    if (lowerMessage.includes('email') || lowerMessage.includes('draft')) {
      return 'email_draft';
    }
    if (lowerMessage.includes('calendar') || lowerMessage.includes('meeting') || lowerMessage.includes('schedule')) {
      return 'calendar_search';
    }
    if (lowerMessage.includes('contact') || lowerMessage.includes('person')) {
      return 'contact_lookup';
    }
    if (lowerMessage.includes('health') || lowerMessage.includes('score')) {
      return 'deal_health';
    }
    
    return null;
  }, []);

  // Helper function to create initial tool call
  const createToolCall = useCallback((toolType: ToolType): ToolCall => {
    const getStepsForTool = (tool: ToolType) => {
      const stepConfigs: Record<ToolType, Array<{ label: string; icon: string }>> = {
        pipeline_data: [
          { label: 'Fetching deals from database', icon: 'database' },
          { label: 'Calculating health scores', icon: 'activity' },
          { label: 'Analyzing priorities', icon: 'activity' },
          { label: 'Generating recommendations', icon: 'activity' }
        ],
        email_draft: [
          { label: 'Loading contact history', icon: 'users' },
          { label: 'Retrieving last meeting notes', icon: 'calendar' },
          { label: 'Generating personalized email', icon: 'mail' }
        ],
        calendar_search: [
          { label: 'Connecting to Google Calendar', icon: 'calendar' },
          { label: 'Filtering meetings', icon: 'activity' },
          { label: 'Loading meeting details', icon: 'activity' }
        ],
        contact_lookup: [
          { label: 'Searching contacts', icon: 'users' },
          { label: 'Loading recent activity', icon: 'activity' }
        ],
        deal_health: [
          { label: 'Analyzing engagement metrics', icon: 'activity' },
          { label: 'Calculating risk factors', icon: 'activity' },
          { label: 'Generating health score', icon: 'activity' }
        ],
        meeting_analysis: [
          { label: 'Loading meeting data', icon: 'calendar' },
          { label: 'Analyzing discussion points', icon: 'activity' },
          { label: 'Generating insights', icon: 'activity' }
        ]
      };

      return stepConfigs[tool] || [];
    };

    const steps = getStepsForTool(toolType).map((config, i) => ({
      id: `step-${i}`,
      label: config.label,
      icon: config.icon,
      state: 'pending' as const
    }));

    return {
      id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tool: toolType,
      state: 'initiating',
      startTime: Date.now(),
      steps
    };
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || state.isLoading) return;

      // Add user message to state
      const userMessage: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date()
      };

      // Detect tool type and create tool call if needed
      const toolType = detectToolType(message);
      let toolCall: ToolCall | undefined;

      if (toolType) {
        toolCall = createToolCall(toolType);
        logger.log('🔧 Created tool call:', { toolType, toolCall });
      }

      // Add assistant message placeholder with tool call
      const assistantMessageId = `assistant-${Date.now()}`;
      const aiMessagePlaceholder: CopilotMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        toolCall
      };

      logger.log('📨 Adding messages:', { userMessage, aiMessagePlaceholder });

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage, aiMessagePlaceholder],
        isLoading: true,
        mode: 'active',
        currentInput: ''
      }));

      try {
        // Simulate tool call progress if tool call exists
        if (toolCall) {
          // Update tool call steps progressively
          for (let i = 0; i < toolCall.steps.length; i++) {
            // Slow down for dramatic effect - each step takes 2-3 seconds
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
            
            setState(prev => {
              const updatedMessages = prev.messages.map(msg => {
                if (msg.id === assistantMessageId && msg.toolCall) {
                  const updatedToolCall: ToolCall = {
                    ...msg.toolCall,
                    state: i === 0 ? 'fetching' : i === toolCall.steps.length - 1 ? 'completing' : 'processing',
                    steps: msg.toolCall.steps.map((step, idx) => ({
                      ...step,
                      state: idx < i ? 'complete' : idx === i ? 'active' : 'pending',
                      duration: idx < i ? (300 + Math.random() * 200) : undefined,
                      metadata: idx < i && step.label.includes('Fetching') ? { count: Math.floor(Math.random() * 100) } : undefined
                    }))
                  };
                  
                  return { ...msg, toolCall: updatedToolCall };
                }
                return msg;
              });
              
              return { ...prev, messages: updatedMessages };
            });
          }

          // Mark tool call as complete (but keep it visible until response arrives)
          setState(prev => {
            const updatedMessages = prev.messages.map(msg => {
              if (msg.id === assistantMessageId && msg.toolCall) {
                return {
                  ...msg,
                  toolCall: {
                    ...msg.toolCall,
                    state: 'complete'
                  }
                };
              }
              return msg;
            });
            
            return { ...prev, messages: updatedMessages };
          });
        }

        // Send to API with timeout
        let response;
        try {
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
          );
          
          response = await Promise.race([
            CopilotService.sendMessage(message, context, state.conversationId),
            timeoutPromise
          ]) as Awaited<ReturnType<typeof CopilotService.sendMessage>>;
        } catch (timeoutError) {
          throw new Error('Request took too long. Please try again.');
        }

        // Update AI message with actual response - this will trigger fade out of tool call
        setState(prev => {
          const updatedMessages = prev.messages.map(msg => {
            if (msg.id === assistantMessageId) {
              const updatedMessage: CopilotMessage = {
                id: msg.id,
                role: msg.role,
                content: response.response.content || 'I processed your request, but received an empty response.',
                timestamp: new Date(response.timestamp),
                recommendations: response.response.recommendations || undefined,
                structuredResponse: response.response.structuredResponse || undefined,
                // Remove toolCall when response is ready to trigger fade out
                toolCall: undefined
              };
              
              return updatedMessage;
            }
            return msg;
          });
          
          return {
            ...prev,
            messages: updatedMessages,
            isLoading: false,
            conversationId: response.conversationId
          };
        });
      } catch (error) {
        logger.error('Error sending message to Copilot:', error);

        // Update the existing assistant message with error and remove tool call
        setState(prev => {
          const updatedMessages = prev.messages.map(msg => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: 'Sorry, I encountered an error processing your request. Please try again.',
                toolCall: undefined // Remove tool call to trigger fade out
              };
            }
            return msg;
          });

          return {
            ...prev,
            messages: updatedMessages,
            isLoading: false
          };
        });
      }
    },
    [context, state.conversationId, state.isLoading, detectToolType, createToolCall]
  );


  const value: CopilotContextValue = {
    isOpen,
    openCopilot,
    closeCopilot,
    sendMessage,
    messages: state.messages,
    isLoading: state.isLoading,
    context,
    setContext
  };

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
};

