/**
 * useEmailActions Hook
 *
 * React Query hooks for managing email actions (HITL approvals + notification-based).
 * Provides unified interface for both real HITL records and simulated notification data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../supabase/clientV2';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

export interface EmailAction {
  id: string;
  type: 'hitl' | 'notification';
  source: 'hitl_pending_approvals' | 'notifications';
  
  // Common fields
  title: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'expired' | 'cancelled' | 'sent';
  created_at: string;
  expires_at?: string;
  
  // Email content
  emailContent: {
    to: string;
    subject: string;
    body: string;
    recipientName?: string;
    recipientEmail?: string;
  };
  
  // Context
  originalEmail?: {
    from: string;
    fromName?: string;
    subject: string;
    snippet?: string;
    receivedAt?: string;
  };
  
  // Linked entities
  contactId?: string;
  dealId?: string;
  meetingId?: string;
  
  // HITL-specific
  approvalId?: string;
  resourceType?: string;
  resourceId?: string;
  
  // Notification-specific
  notificationId?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// Query Keys
// =============================================================================

const EMAIL_ACTIONS_QUERY_KEYS = {
  all: ['email-actions'] as const,
  pending: (orgId: string) => ['email-actions', 'pending', orgId] as const,
  byId: (id: string) => ['email-actions', id] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch all pending email actions for the current user
 */
export function useEmailActions() {
  const { activeOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg?.id || ''),
    queryFn: async (): Promise<EmailAction[]> => {
      if (!activeOrg?.id || !user?.id) return [];

      const actions: EmailAction[] = [];

      // 1. Fetch HITL pending approvals for email drafts
      const { data: hitlApprovals, error: hitlError } = await supabase
        .from('hitl_pending_approvals')
        .select('*')
        .eq('org_id', activeOrg.id)
        .eq('user_id', user.id)
        .in('status', ['pending'])
        .in('resource_type', ['email_draft', 'follow_up'])
        .order('created_at', { ascending: false });

      if (!hitlError && hitlApprovals) {
        for (const approval of hitlApprovals) {
          const content = (approval.original_content || {}) as Record<string, any>;
          const emailContent = {
            to: content.recipientEmail || content.recipient || content.to || '',
            subject: content.subject || 'Following up',
            body: content.body || content.html || '',
            recipientName: content.recipientName || content.name || '',
            recipientEmail: content.recipientEmail || content.recipient || content.to || '',
          };

          actions.push({
            id: `hitl-${approval.id}`,
            type: 'hitl',
            source: 'hitl_pending_approvals',
            title: approval.resource_name || 'Email Draft',
            message: `AI-generated email draft ready for review`,
            status: approval.status as EmailAction['status'],
            created_at: approval.created_at,
            expires_at: approval.expires_at,
            emailContent,
            originalEmail: content.originalEmail || undefined,
            contactId: content.contactId || undefined,
            dealId: content.dealId || undefined,
            meetingId: content.meetingId || undefined,
            approvalId: approval.id,
            resourceType: approval.resource_type,
            resourceId: approval.resource_id,
            metadata: approval.metadata || {},
          });
        }
      }

      // 2. Fetch notifications with email-related metadata
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('entity_type', ['email', 'email_draft', 'email_reply_alert'])
        .or('read.is.null,read.eq.false')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!notifError && notifications) {
        for (const notification of notifications) {
          // Check if notification metadata contains email content
          const metadata = notification.metadata || {};
          const hasEmailContent = 
            metadata.emailContent ||
            metadata.suggestedResponse ||
            metadata.draft ||
            (metadata.source === 'proactive_simulator' && notification.entity_type === 'email');

          if (hasEmailContent) {
            const emailContent = metadata.emailContent || metadata.suggestedResponse || metadata.draft || {};
            const originalEmail = metadata.originalEmail || {};

            actions.push({
              id: `notif-${notification.id}`,
              type: 'notification',
              source: 'notifications',
              title: notification.title,
              message: notification.message,
              status: notification.read ? 'sent' : 'pending',
              created_at: notification.created_at,
              expires_at: notification.expires_at,
              emailContent: {
                to: emailContent.to || emailContent.recipient || originalEmail.from || '',
                subject: emailContent.subject || `Re: ${originalEmail.subject || ''}`,
                body: emailContent.body || emailContent.content || emailContent.html || '',
                recipientName: emailContent.recipientName || emailContent.name || originalEmail.fromName || '',
                recipientEmail: emailContent.to || emailContent.recipient || originalEmail.from || '',
              },
              originalEmail: {
                from: originalEmail.from || '',
                fromName: originalEmail.fromName || originalEmail.from || '',
                subject: originalEmail.subject || '',
                snippet: originalEmail.snippet || originalEmail.body || '',
                receivedAt: originalEmail.receivedAt || originalEmail.date || '',
              },
              contactId: metadata.contactId || undefined,
              dealId: metadata.dealId || undefined,
              meetingId: metadata.meetingId || undefined,
              notificationId: notification.id,
              metadata,
            });
          }
        }
      }

      // Sort by created_at descending
      return actions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!activeOrg?.id && !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Set up real-time subscription for HITL approvals
  useEffect(() => {
    if (!activeOrg?.id || !user?.id) return;

    const channel = supabase
      .channel(`email-actions-${activeOrg.id}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hitl_pending_approvals',
          filter: `org_id=eq.${activeOrg.id},user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg.id!),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg.id!),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrg?.id, user?.id, queryClient]);

  return query;
}

/**
 * Fetch a single email action by ID
 */
export function useEmailAction(actionId: string | undefined) {
  const { data: actions } = useEmailActions();
  
  return {
    data: actions?.find(a => a.id === actionId),
    isLoading: false,
  };
}

/**
 * Approve and send an email action
 */
export function useApproveEmailAction() {
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ actionId, editedContent }: { actionId: string; editedContent?: { to: string; subject: string; body: string } }) => {
      // Fetch current actions from cache
      const cachedData = queryClient.getQueryData<EmailAction[]>(
        EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg?.id || '')
      );

      const emailAction = cachedData?.find(a => a.id === actionId);
      if (!emailAction) {
        throw new Error('Email action not found');
      }

      if (emailAction.type === 'hitl' && emailAction.approvalId) {
        // Call HITL edge function to approve and send
        const content = editedContent || emailAction.emailContent;
        
        // Note: hitl-send-followup-email requires service role auth, so we'll need
        // to create a user-facing wrapper or use a different approach.
        // For now, we'll use a direct API call pattern similar to other edge functions.
        const { data, error } = await supabase.functions.invoke('hitl-send-followup-email', {
          body: {
            approval_id: emailAction.approvalId,
            action: editedContent ? 'edited' : 'approved',
            content: {
              recipientEmail: content.to,
              recipient: content.to,
              to: content.to,
              subject: content.subject,
              body: content.body,
            },
          },
        });

        if (error) {
          throw new Error(error.message || 'Failed to send email');
        }

        return data;
      } else if (emailAction.type === 'notification') {
        // For notification-based actions, use Gmail send via edge function
        const content = editedContent || emailAction.emailContent;
        
        const { data, error } = await supabase.functions.invoke('google-gmail', {
          body: {
            action: 'send',
            userId: user?.id,
            to: content.to,
            subject: content.subject,
            body: content.body,
            isHtml: false,
          },
        });

        if (error) {
          throw new Error(error.message || 'Failed to send email');
        }

        // Mark notification as read
        if (emailAction.notificationId) {
          await supabase
            .from('notifications')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('id', emailAction.notificationId);
        }

        return data;
      }

      throw new Error('Unsupported action type');
    },
    onSuccess: () => {
      if (activeOrg?.id) {
        queryClient.invalidateQueries({
          queryKey: EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg.id),
        });
      }
      toast.success('Email sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email');
    },
  });
}

/**
 * Reject/dismiss an email action
 */
export function useRejectEmailAction() {
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();

  return useMutation({
    mutationFn: async (actionId: string) => {
      // Fetch current actions from cache
      const cachedData = queryClient.getQueryData<EmailAction[]>(
        EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg?.id || '')
      );

      const emailAction = cachedData?.find(a => a.id === actionId);
      if (!emailAction) {
        throw new Error('Email action not found');
      }

      if (emailAction.type === 'hitl' && emailAction.approvalId) {
        // Call HITL edge function to reject
        const { data, error } = await supabase.functions.invoke('hitl-send-followup-email', {
          body: {
            approval_id: emailAction.approvalId,
            action: 'rejected',
          },
        });

        if (error) {
          throw new Error(error.message || 'Failed to reject');
        }

        return data;
      } else if (emailAction.type === 'notification' && emailAction.notificationId) {
        // Mark notification as read/dismissed
        await supabase
          .from('notifications')
          .update({ read: true, read_at: new Date().toISOString() })
          .eq('id', emailAction.notificationId);

        return { success: true };
      }

      throw new Error('Unsupported action type');
    },
    onSuccess: () => {
      if (activeOrg?.id) {
        queryClient.invalidateQueries({
          queryKey: EMAIL_ACTIONS_QUERY_KEYS.pending(activeOrg.id),
        });
      }
      toast.success('Email action dismissed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to dismiss');
    },
  });
}
