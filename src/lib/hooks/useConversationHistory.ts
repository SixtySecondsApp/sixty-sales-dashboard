/**
 * Conversation History Hook
 * Fetches and manages CoPilot conversation history
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuthUser } from '@/lib/hooks/useAuthUser';

export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ConversationWithMessages {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

const CONVERSATION_HISTORY_KEY = ['copilot', 'conversations'];

/**
 * Hook to fetch recent conversations
 */
export function useConversationHistory(limit: number = 20) {
  const { data: user } = useAuthUser();

  return useQuery({
    queryKey: [...CONVERSATION_HISTORY_KEY, user?.id, limit],
    queryFn: async (): Promise<ConversationSummary[]> => {
      if (!user?.id) return [];

      // Fetch conversations with message count and last message
      const { data: conversations, error } = await supabase
        .from('copilot_conversations')
        .select(`
          id,
          title,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching conversations:', error);
        throw error;
      }

      if (!conversations || conversations.length === 0) {
        return [];
      }

      // Fetch message counts and last messages for each conversation
      const conversationIds = conversations.map(c => c.id);

      const { data: messageCounts, error: countError } = await supabase
        .from('copilot_messages')
        .select('conversation_id, content, role, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (countError) {
        console.error('Error fetching message counts:', countError);
      }

      // Build summary for each conversation
      const summaries: ConversationSummary[] = conversations.map(conv => {
        const convMessages = messageCounts?.filter(m => m.conversation_id === conv.id) || [];
        const userMessage = convMessages.find(m => m.role === 'user');

        return {
          id: conv.id,
          title: conv.title || (userMessage?.content?.substring(0, 50) + (userMessage?.content?.length > 50 ? '...' : '')) || 'New Conversation',
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          message_count: convMessages.length,
          last_message: userMessage?.content
        };
      });

      return summaries;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch a single conversation with all messages
 */
export function useConversation(conversationId: string | undefined) {
  const { data: user } = useAuthUser();

  return useQuery({
    queryKey: [...CONVERSATION_HISTORY_KEY, 'detail', conversationId],
    queryFn: async (): Promise<ConversationWithMessages | null> => {
      if (!conversationId || !user?.id) return null;

      const { data: conversation, error: convError } = await supabase
        .from('copilot_conversations')
        .select('id, title, created_at, updated_at')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (convError) {
        console.error('Error fetching conversation:', convError);
        throw convError;
      }

      if (!conversation) return null;

      const { data: messages, error: msgError } = await supabase
        .from('copilot_messages')
        .select('id, role, content, metadata, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('Error fetching messages:', msgError);
        throw msgError;
      }

      return {
        ...conversation,
        messages: messages || []
      };
    },
    enabled: !!conversationId && !!user?.id,
  });
}

/**
 * Hook to delete a conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { data: user } = useAuthUser();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Delete messages first (foreign key constraint)
      const { error: msgError } = await supabase
        .from('copilot_messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (msgError) throw msgError;

      // Then delete conversation
      const { error: convError } = await supabase
        .from('copilot_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (convError) throw convError;

      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATION_HISTORY_KEY });
    },
  });
}

export default useConversationHistory;
