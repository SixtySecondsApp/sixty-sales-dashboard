import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Mail,
  Sparkles,
  PlusCircle,
  Calendar,
  ArrowRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCopilot?: () => void;
  onDraftEmail?: () => void;
  onAddContact?: () => void;
  onScheduleMeeting?: () => void;
  onSelectContact?: (contactId: string) => void;
  onAskCopilot?: (query: string) => void;
}

interface RecentContact {
  id: string;
  name: string;
  company: string;
  initials: string;
  color: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut: string;
  action: () => void;
}

export const SmartSearch: React.FC<SmartSearchProps> = ({
  isOpen,
  onClose,
  onOpenCopilot,
  onDraftEmail,
  onAddContact,
  onScheduleMeeting,
  onSelectContact,
  onAskCopilot
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const recentContacts: RecentContact[] = [
    {
      id: '1',
      name: 'Alexander Wolf',
      company: 'Alexander Wolf Agency',
      initials: 'AW',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: '2',
      name: 'Russell Gentry',
      company: 'M1 Data',
      initials: 'RG',
      color: 'from-emerald-500 to-emerald-600'
    }
  ];

  const quickActions: QuickAction[] = [
    {
      id: 'draft-email',
      label: 'Draft follow-up email',
      icon: Mail,
      shortcut: 'E',
      action: () => {
        onDraftEmail?.();
        onClose();
      }
    },
    {
      id: 'open-copilot',
      label: 'Open Copilot',
      icon: Sparkles,
      shortcut: 'C',
      action: () => {
        onOpenCopilot?.();
        onClose();
      }
    },
    {
      id: 'add-contact',
      label: 'Add new contact',
      icon: PlusCircle,
      shortcut: 'N',
      action: () => {
        onAddContact?.();
        onClose();
      }
    },
    {
      id: 'schedule-meeting',
      label: 'Schedule meeting',
      icon: Calendar,
      shortcut: 'M',
      action: () => {
        onScheduleMeeting?.();
        onClose();
      }
    }
  ];

  const aiSuggestions = [
    {
      id: '1',
      query: 'What are my top priorities today?',
      action: () => {
        onAskCopilot?.('What are my top priorities today?');
        onClose();
      }
    },
    {
      id: '2',
      query: 'Show me at-risk deals',
      action: () => {
        onAskCopilot?.('Show me at-risk deals');
        onClose();
      }
    },
    {
      id: '3',
      query: 'Summarize my pipeline for this week',
      action: () => {
        onAskCopilot?.('Summarize my pipeline for this week');
        onClose();
      }
    }
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // This will be handled by parent component
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
          >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-800/50">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search contacts, deals, or ask Copilot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 text-base focus:outline-none"
          />
          <kbd className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {/* Quick Actions */}
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Actions</p>
            <div className="space-y-1">
              {quickActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300 flex-1">{action.label}</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700/50 rounded text-xs text-gray-500">
                      {action.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Contacts */}
          <div className="px-3 py-2 mt-2 border-t border-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Contacts</p>
            <div className="space-y-1">
              {recentContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => {
                    onSelectContact?.(contact.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                >
                  <div
                    className={cn(
                      'w-8 h-8 bg-gradient-to-br rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                      contact.color
                    )}
                  >
                    {contact.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{contact.name}</p>
                    <p className="text-xs text-gray-500">{contact.company}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="px-3 py-2 mt-2 border-t border-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Ask Copilot
            </p>
            <div className="space-y-1">
              {aiSuggestions.map(suggestion => (
                <button
                  key={suggestion.id}
                  onClick={suggestion.action}
                  className="w-full flex items-start gap-3 px-3 py-2 hover:bg-blue-500/10 hover:border-blue-500/20 border border-transparent rounded-lg transition-all text-left"
                >
                  <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{suggestion.query}</span>
                </button>
              ))}
            </div>
          </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

