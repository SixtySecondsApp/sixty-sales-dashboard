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
  CopilotContextPayload,
  Recommendation,
  ToolCall,
  ToolType
} from '@/components/copilot/types';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

interface CopilotContextValue {
  isOpen: boolean;
  openCopilot: (initialQuery?: string, startNewChat?: boolean) => void;
  closeCopilot: () => void;
  sendMessage: (message: string) => Promise<void>;
  messages: CopilotMessage[];
  isLoading: boolean;
  context: CopilotContextType;
  setContext: (context: Partial<CopilotContextType>) => void;
  startNewChat: () => void;
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
    currentView: 'dashboard',
    context: {
    userId: '',
    currentView: 'dashboard'
    }
  });
  const [pendingQuery, setPendingQuery] = useState<{ query: string; startNewChat: boolean } | null>(null);

  // Initialize user context
  React.useEffect(() => {
    const initContext = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session?.user) {
        setContextState(prev => ({
          ...prev,
          userId: session.user.id,
          context: {
            ...prev.context,
          userId: session.user.id
          }
        }));
      }
    };
    initContext();
  }, []);

  const startNewChat = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      conversationId: undefined,
      currentInput: '',
      mode: 'empty',
      isLoading: false
    }));
  }, []);

  const openCopilot = useCallback((initialQuery?: string, startNewChatFlag?: boolean) => {
    setIsOpen(true);
    
    // If starting a new chat, reset the conversation state
    if (startNewChatFlag) {
      // Reset state first - this will clear messages and conversationId
      setState({
        messages: [],
        conversationId: undefined,
        currentInput: initialQuery || '',
        mode: initialQuery ? 'active' : 'empty',
        isLoading: false
      });
      
      // Set pending query to trigger auto-send after state reset
    if (initialQuery) {
        setPendingQuery({ query: initialQuery, startNewChat: true });
      }
    } else if (initialQuery) {
      setState(prev => ({
        ...prev,
        currentInput: initialQuery,
        mode: 'active'
      }));
      // Set pending query to trigger auto-send
      setPendingQuery({ query: initialQuery, startNewChat: false });
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
    setContextState(prev => {
      // If newContext has a context property, merge it with the existing context
      if (newContext.context) {
        return {
          ...prev,
          ...newContext,
          context: {
            ...prev.context,
            ...newContext.context
          }
        };
      }
      return { ...prev, ...newContext };
    });
  }, []);

  // Helper function to detect intent and determine tool type
  const detectToolType = useCallback((message: string): ToolType | null => {
    const lowerMessage = message.toLowerCase();
    
    // Contact/email queries - check for email addresses or contact names
    const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/;
    const hasEmail = emailPattern.test(message);
    const contactKeywords = ['contact', 'person', 'about', 'info on', 'tell me about', 'show me', 'lookup', 'find'];
    const hasContactKeyword = contactKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasEmail || (hasContactKeyword && (lowerMessage.includes('@') || lowerMessage.includes('email')))) {
      return 'contact_search';
    }
    
    // Task queries - check before pipeline to avoid conflicts
    if (
      lowerMessage.includes('task') || 
      lowerMessage.includes('tasks') || 
      lowerMessage.includes('todo') ||
      lowerMessage.includes('to-do') ||
      (lowerMessage.includes('list') && (lowerMessage.includes('task') || lowerMessage.includes('priority'))) ||
      (lowerMessage.includes('show') && lowerMessage.includes('task')) ||
      lowerMessage.includes('high priority task') ||
      lowerMessage.includes('overdue')
    ) {
      return 'task_search';
    }
    
    // General "prioritize" questions default to tasks (more actionable day-to-day)
    // But if pipeline/deal is mentioned, use pipeline
    if (lowerMessage.includes('prioritize') || lowerMessage.includes('what should i prioritize')) {
      if (lowerMessage.includes('pipeline') || lowerMessage.includes('deal') || lowerMessage.includes('deals')) {
        return 'pipeline_data';
      }
      // Default to tasks for general prioritize questions
      return 'task_search';
    }
    
    if (lowerMessage.includes('pipeline') || lowerMessage.includes('deal') || lowerMessage.includes('priority') || lowerMessage.includes('attention')) {
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
    if (
      lowerMessage.includes('roadmap') || 
      lowerMessage.includes('add a roadmap') ||
      lowerMessage.includes('create roadmap') ||
      lowerMessage.includes('roadmap item')
    ) {
      return 'roadmap_create';
    }
    if (
      lowerMessage.includes('performance') ||
      lowerMessage.includes('how am i doing') ||
      lowerMessage.includes('how is my performance') ||
      lowerMessage.includes('sales coach') ||
      lowerMessage.includes('compare') && (lowerMessage.includes('month') || lowerMessage.includes('period')) ||
      (lowerMessage.includes('this month') && lowerMessage.includes('last month'))
    ) {
      return 'sales_coach';
    }
    
    return null;
  }, []);

  // Helper function to create initial tool call
  const createToolCall = useCallback((toolType: ToolType): ToolCall => {
      const getStepsForTool = (tool: ToolType) => {
      const stepConfigs: Record<ToolType, Array<{ label: string; icon: string }>> = {
        task_search: [
          { label: 'Searching tasks database', icon: 'database' },
          { label: 'Filtering by priority and status', icon: 'activity' },
          { label: 'Calculating due dates', icon: 'calendar' },
          { label: 'Organizing results', icon: 'activity' }
        ],
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
        contact_search: [
          { label: 'Finding contact by email', icon: 'users' },
          { label: 'Fetching emails and communications', icon: 'mail' },
          { label: 'Loading deals and activities', icon: 'activity' },
          { label: 'Gathering meetings and tasks', icon: 'calendar' },
          { label: 'Compiling smart summary', icon: 'activity' }
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
        ],
        roadmap_create: [
          { label: 'Preparing roadmap item', icon: 'file-text' },
          { label: 'Validating details', icon: 'activity' },
          { label: 'Creating roadmap item', icon: 'database' },
          { label: 'Confirming creation', icon: 'check-circle' }
        ],
        sales_coach: [
          { label: 'Gathering sales data', icon: 'database' },
          { label: 'Analyzing performance metrics', icon: 'activity' },
          { label: 'Comparing periods', icon: 'bar-chart' },
          { label: 'Generating insights', icon: 'lightbulb' },
          { label: 'Creating recommendations', icon: 'target' }
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
          
          // Format context for API
          const apiContext: CopilotContextPayload['context'] = {
            userId: context.userId || context.context?.userId || '',
            currentView: context.currentView || context.context?.currentView || 'dashboard',
            contactId: context.context?.contactId,
            dealIds: context.context?.dealIds,
            taskId: context.context?.taskId
          };
          
          response = await Promise.race([
            CopilotService.sendMessage(message, apiContext, state.conversationId),
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

  // Handle pending queries from openCopilot
  React.useEffect(() => {
    if (pendingQuery) {
      const { query, startNewChat } = pendingQuery;
      setPendingQuery(null); // Clear pending query
      
      // For new chats, add a small delay to ensure state is reset
      const delay = startNewChat ? 200 : 100;
      setTimeout(() => {
        sendMessage(query);
      }, delay);
    }
  }, [pendingQuery, sendMessage]);

  const value: CopilotContextValue = {
    isOpen,
    openCopilot,
    closeCopilot,
    sendMessage,
    messages: state.messages,
    isLoading: state.isLoading,
    context,
    setContext,
    startNewChat
  };

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
};

