/**
 * Conversation History Component
 * Displays a list of past CoPilot conversations
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Trash2, Plus, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConversationHistory, useDeleteConversation, ConversationSummary } from '@/lib/hooks/useConversationHistory';
import { toast } from 'sonner';

interface ConversationHistoryProps {
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  className?: string;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  className
}) => {
  const { data: conversations, isLoading, error } = useConversationHistory(20);
  const deleteConversation = useDeleteConversation();

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();

    if (!confirm('Delete this conversation?')) return;

    try {
      await deleteConversation.mutateAsync(conversationId);
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-sm text-red-500', className)}>
        Failed to load conversations
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          History
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewConversation}
          className="h-8 px-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {!conversations || conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No conversations yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          <ul className="py-2">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === currentConversationId}
                onClick={() => onSelectConversation(conv.id)}
                onDelete={(e) => handleDelete(e, conv.id)}
                isDeleting={deleteConversation.isPending}
                formatTime={formatTime}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
  formatTime: (date: string) => string;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onDelete,
  isDeleting,
  formatTime
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors group cursor-pointer',
          'hover:bg-gray-50 dark:hover:bg-gray-800/50',
          isActive && 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
        )}
      >
        <MessageSquare className={cn(
          'w-4 h-4 mt-0.5 flex-shrink-0',
          isActive ? 'text-blue-500' : 'text-gray-400'
        )} />

        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium truncate',
            isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
          )}>
            {conversation.title || 'New Conversation'}
          </p>

          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(conversation.updated_at)}
            </span>
            {conversation.message_count > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                · {conversation.message_count} messages
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className={cn(
            'p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500'
          )}
          title="Delete conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
};

export default ConversationHistory;
