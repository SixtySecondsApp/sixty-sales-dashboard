/**
 * AI Copilot Component
 * Main component for ChatGPT-style conversational interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { CopilotEmpty } from './copilot/CopilotEmpty';
import { ChatMessage } from './copilot/ChatMessage';
import { ChatInput } from './copilot/ChatInput';
import { CopilotService } from '@/lib/services/copilotService';
import logger from '@/lib/utils/logger';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

interface CopilotProps {
  onGenerateEmail?: (contactId?: string) => void;
  onDraftEmail?: (contactId?: string) => void;
  initialQuery?: string;
}

export const Copilot: React.FC<CopilotProps> = ({
  onGenerateEmail,
  onDraftEmail,
  initialQuery
}) => {
  const { messages, isLoading, sendMessage, context } = useCopilot();
  const [inputValue, setInputValue] = useState(initialQuery || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [suggestedPrompts] = useState([
    'What should I prioritize today?',
    'Show me deals that need attention',
    'Draft a follow-up email for Alexander Wolf'
  ]);

  // Auto-send initial query if provided
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      sendMessage(initialQuery);
      setInputValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    // Auto-send when clicking a prompt
    setTimeout(() => {
      sendMessage(prompt);
      setInputValue('');
    }, 100);
  };

  const handleActionClick = async (action: any, data?: any) => {
    // Handle string-based actions (from CommunicationHistoryResponse)
    if (typeof action === 'string') {
      const emailId = data?.emailId;
      
      switch (action) {
        case 'reply':
          if (!emailId) {
            toast.error('Email ID is required to reply');
            return;
          }
          try {
            // Get email details first to extract reply information
            const { data: emailData, error: emailError } = await supabase.functions.invoke('google-gmail', {
              body: { action: 'get', messageId: emailId }
            });
            
            if (emailError) throw emailError;
            
            // Extract reply-to email from headers
            const headers = emailData?.payload?.headers || [];
            const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === 'from');
            const subjectHeader = headers.find((h: any) => h.name?.toLowerCase() === 'subject');
            
            // Extract email from "Name <email@example.com>" format
            const extractEmail = (str: string) => {
              const match = str.match(/<(.+)>/);
              return match ? match[1] : str.trim();
            };
            
            const replyTo = fromHeader ? extractEmail(fromHeader.value) : '';
            const subject = subjectHeader?.value || 'Re: Email';
            const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
            
            // Prompt user for reply body (in a real implementation, you'd open a composer modal)
            const replyBody = prompt(`Reply to: ${replyTo}\nSubject: ${replySubject}\n\nEnter your reply:`);
            
            if (!replyBody) {
              return; // User cancelled
            }
            
            // Send reply via Gmail API
            const { error: replyError } = await supabase.functions.invoke('google-gmail?action=reply', {
              body: {
                messageId: emailId,
                body: replyBody,
                replyAll: false,
                isHtml: false
              }
            });
            
            if (replyError) throw replyError;
            
            toast.success('Reply sent successfully');
            logger.log('Reply sent:', emailId);
          } catch (error) {
            logger.error('Error replying to email:', error);
            toast.error('Failed to send reply');
          }
          break;
          
        case 'forward':
          if (!emailId) {
            toast.error('Email ID is required to forward');
            return;
          }
          try {
            // Prompt user for recipients
            const recipientsInput = prompt('Enter email addresses to forward to (comma-separated):');
            if (!recipientsInput) {
              return; // User cancelled
            }
            
            const recipients = recipientsInput.split(',').map(e => e.trim()).filter(e => e);
            if (recipients.length === 0) {
              toast.error('Please enter at least one recipient');
              return;
            }
            
            // Optional: Prompt for additional message
            const additionalMessage = prompt('Optional: Add a message before forwarding:') || undefined;
            
            // Forward email via Gmail API
            const { error: forwardError } = await supabase.functions.invoke('google-gmail?action=forward', {
              body: {
                messageId: emailId,
                to: recipients,
                additionalMessage
              }
            });
            
            if (forwardError) throw forwardError;
            
            toast.success('Email forwarded successfully');
            logger.log('Email forwarded:', emailId);
          } catch (error) {
            logger.error('Error forwarding email:', error);
            toast.error('Failed to forward email');
          }
          break;
          
        case 'archive':
          if (!emailId) {
            toast.error('Email ID is required to archive');
            return;
          }
          try {
            const { error } = await supabase.functions.invoke('google-gmail?action=archive', {
              body: { messageId: emailId }
            });
            
            if (error) throw error;
            
            toast.success('Email archived successfully');
            logger.log('Email archived:', emailId);
          } catch (error) {
            logger.error('Error archiving email:', error);
            toast.error('Failed to archive email');
          }
          break;
          
        case 'star':
          if (!emailId) {
            toast.error('Email ID is required to star');
            return;
          }
          try {
            // Toggle star - we'd need to check current state, but for now just star it
            const { error } = await supabase.functions.invoke('google-gmail?action=star', {
              body: { messageId: emailId, starred: true }
            });
            
            if (error) throw error;
            
            toast.success('Email starred');
            logger.log('Email starred:', emailId);
          } catch (error) {
            logger.error('Error starring email:', error);
            toast.error('Failed to star email');
          }
          break;
          
        case 'add_to_task':
          if (!emailId) {
            toast.error('Email ID is required to create task');
            return;
          }
          try {
            // Get email details first
            const { data: emailData, error: emailError } = await supabase.functions.invoke('google-gmail', {
              body: { action: 'get', messageId: emailId }
            });
            
            if (emailError) throw emailError;
            
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              toast.error('You must be logged in to create tasks');
              return;
            }
            
            // Extract email subject and snippet for task
            const subject = emailData?.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'Email follow-up';
            const snippet = emailData?.snippet || '';
            
            // Create task from email
            const taskData: any = {
              title: `Follow up: ${subject}`,
              description: `Task created from email:\n\n${snippet}`,
              status: 'todo',
              priority: 'medium',
              task_type: 'email',
              assigned_to: user.id,
              created_by: user.id,
              contact_email: user.email, // Required field
              due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
            };
            
            // Add metadata if supported
            try {
              taskData.metadata = {
                source: 'email_copilot',
                email_id: emailId
              };
            } catch (e) {
              // Metadata might not be supported, continue without it
            }
            
            const { data: task, error: taskError } = await supabase
              .from('tasks')
              .insert(taskData)
              .select()
              .single();
            
            if (taskError) throw taskError;
            
            toast.success('Task created successfully');
            logger.log('Task created from email:', task);
          } catch (error) {
            logger.error('Error creating task from email:', error);
            toast.error('Failed to create task from email');
          }
          break;
          
        default:
          logger.log('Unknown action:', action);
      }
      return;
    }
    
    // Handle special action types
    if (action === 'search_emails' || (typeof action === 'object' && action.type === 'search_emails')) {
      const params = typeof action === 'object' ? action : {};
      const query = params.contactEmail 
        ? `Show me all emails from ${params.contactName || params.contactEmail}`
        : 'Show me my recent emails';
      sendMessage(query);
      return;
    }
    
    // Handle API callbacks
    if (action.callback && action.callback.startsWith('/api/')) {
      try {
        const response = await fetch(action.callback, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(action.params || {})
        });
        
        if (response.ok) {
          const result = await response.json();
          logger.log('Action completed:', result);
          // Optionally refresh data or show success message
        } else {
          logger.error('Action failed:', response.statusText);
        }
      } catch (error) {
        logger.error('Error executing action:', error);
      }
      return;
    }

    // Handle action types
    switch (action.type) {
      case 'draft_email':
        if (action.contactId || context.contactId) {
          try {
            const emailDraft = await CopilotService.draftEmail(
              action.contactId || context.contactId!,
              'Follow-up email based on recent activity',
              'professional'
            );
            onDraftEmail?.(action.contactId || context.contactId);
          } catch (error) {
            logger.error('Error drafting email:', error);
          }
        } else {
          onDraftEmail?.();
        }
        break;
      case 'view_deal':
        if (action.href || action.dealId) {
          const url = action.href || `/crm/deals/${action.dealId}`;
          window.location.href = url;
        }
        break;
      case 'view_contact':
        if (action.href || action.contactId) {
          const url = action.href || `/crm/contacts/${action.contactId}`;
          window.location.href = url;
        }
        break;
      case 'schedule_call':
        // Handle schedule call action
        logger.log('Schedule call action');
        break;
      default:
        // Handle callback function if provided
        if (typeof action.callback === 'function') {
          action.callback();
        } else if (action.callback && action.callback.startsWith('/')) {
          window.location.href = action.callback;
        }
    }
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Empty State or Active Conversation */}
      {isEmpty ? (
        <CopilotEmpty onPromptClick={handlePromptClick} />
      ) : (
        <>
          {/* Chat Messages Area */}
          <div className="flex-1 space-y-6 mb-6 overflow-y-auto">
            {messages.map(message => {
              // Stable key based on message ID only - prevents unnecessary re-renders
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onActionClick={handleActionClick}
                />
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={isLoading}
            suggestedPrompts={suggestedPrompts}
            onPromptClick={handlePromptClick}
          />
        </>
      )}
    </div>
  );
};

