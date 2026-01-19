/**
 * Copilot Layout Component
 * Two-panel layout: Chat (left) + Right Sidebar (Action Items, Context, Connected)
 *
 * Key constraints:
 * - 100vh viewport compliance (no page scroll)
 * - Chat input always visible at bottom
 * - Messages scroll within their container
 * - Right panel scrolls independently
 */

import React, { useState } from 'react';
import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { ConversationHistory } from './ConversationHistory';

interface CopilotLayoutProps {
  children: React.ReactNode;
  /** Optional right panel content - renders Action Items, Context, Connected sections */
  rightPanel?: React.ReactNode;
}

export const CopilotLayout: React.FC<CopilotLayoutProps> = ({ children, rightPanel }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
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
    // Main container: 100% of available height, no overflow (page doesn't scroll)
    <div className="flex h-full min-h-0 relative overflow-hidden">
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

      {/* Right Panel Toggle Button (only shown when rightPanel is provided) */}
      {rightPanel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRightPanel(!showRightPanel)}
          className={cn(
            'absolute top-4 right-4 z-20 h-9 px-3 gap-2',
            'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
            'border border-gray-200 dark:border-gray-700/50',
            'hover:bg-gray-50 dark:hover:bg-gray-800/80',
            'text-gray-600 dark:text-gray-400',
            'lg:hidden' // Only show on mobile/tablet, right panel always visible on desktop
          )}
        >
          {showRightPanel ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRight className="w-4 h-4" />
          )}
        </Button>
      )}

      {/* History Sidebar (Left) */}
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

      {/* Overlay for mobile (history) */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/20 z-[5] md:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* Main Chat Area - flex-1 to take remaining space */}
      <div className={cn(
        'flex-1 min-h-0 min-w-0 flex flex-col transition-all duration-300',
        showHistory && 'md:ml-0'
      )}>
        {children}
      </div>

      {/* Right Panel - Action Items, Context, Connected */}
      {rightPanel && (
        <>
          {/* Mobile/Tablet overlay */}
          {showRightPanel && (
            <div
              className="fixed inset-0 bg-black/20 z-[5] lg:hidden"
              onClick={() => setShowRightPanel(false)}
            />
          )}

          {/* Right panel container */}
          <div
            className={cn(
              'absolute lg:relative z-10 right-0 h-full transition-all duration-300 ease-in-out',
              'bg-white/[0.02] dark:bg-gray-900/50 backdrop-blur-xl',
              'border-l border-gray-200 dark:border-white/5',
              // Width and visibility
              showRightPanel
                ? 'w-80 opacity-100'
                : 'w-0 opacity-0 overflow-hidden lg:w-0'
            )}
          >
            {/* Inner container with fixed width to prevent content reflow */}
            <div className="w-80 h-full overflow-y-auto">
              {rightPanel}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CopilotLayout;
