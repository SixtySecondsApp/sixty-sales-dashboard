/**
 * Copilot Layout Component
 * Combines conversation history sidebar with main chat interface
 */

import React, { useState } from 'react';
import { History, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { ConversationHistory } from './ConversationHistory';

interface CopilotLayoutProps {
  children: React.ReactNode;
}

export const CopilotLayout: React.FC<CopilotLayoutProps> = ({ children }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { conversationId, loadConversation, startNewChat } = useCopilot();

  const handleSelectConversation = async (convId: string) => {
    await loadConversation(convId);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setShowHistory(false);
    }
  };

  const handleNewConversation = () => {
    startNewChat();
    if (window.innerWidth < 768) {
      setShowHistory(false);
    }
  };

  return (
    <div className="flex h-full relative">
      {/* History Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistory(!showHistory)}
        className={cn(
          'absolute top-4 left-4 z-20 h-9 px-3 gap-2',
          'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
          'border border-gray-200 dark:border-gray-700/50',
          'hover:bg-gray-50 dark:hover:bg-gray-800/80',
          'text-gray-600 dark:text-gray-400'
        )}
      >
        {showHistory ? (
          <PanelLeftClose className="w-4 h-4" />
        ) : (
          <PanelLeft className="w-4 h-4" />
        )}
        <span className="text-sm hidden sm:inline">History</span>
      </Button>

      {/* History Sidebar */}
      <div
        className={cn(
          'absolute md:relative z-10 h-full transition-all duration-300 ease-in-out',
          'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700/50',
          showHistory ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        )}
      >
        <div className="w-72 h-full pt-14">
          <ConversationHistory
            currentConversationId={conversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        </div>
      </div>

      {/* Overlay for mobile */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/20 z-[5] md:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className={cn(
        'flex-1 transition-all duration-300',
        showHistory && 'md:ml-0'
      )}>
        {children}
      </div>
    </div>
  );
};

export default CopilotLayout;
