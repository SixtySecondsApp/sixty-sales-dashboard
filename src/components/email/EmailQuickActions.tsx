import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Keyboard, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Archive, 
  Star, 
  RefreshCw, 
  Search, 
  MessageSquare,
  Eye,
  Trash2,
  Flag,
  Reply,
  Forward,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

const shortcuts = [
  {
    category: 'Navigation',
    actions: [
      { key: 'j', icon: ArrowDown, description: 'Next email', color: 'text-blue-400' },
      { key: 'k', icon: ArrowUp, description: 'Previous email', color: 'text-blue-400' },
      { key: 'Enter', icon: Eye, description: 'Open email', color: 'text-blue-400' },
      { key: 'u', icon: X, description: 'Back to inbox', color: 'text-blue-400' },
    ]
  },
  {
    category: 'Actions',
    actions: [
      { key: 'e', icon: Archive, description: 'Archive', color: 'text-emerald-400' },
      { key: 's', icon: Star, description: 'Star/Unstar', color: 'text-yellow-400' },
      { key: 'r', icon: Reply, description: 'Reply', color: 'text-purple-400' },
      { key: 'f', icon: Forward, description: 'Forward', color: 'text-purple-400' },
      { key: '#', icon: Trash2, description: 'Delete', color: 'text-red-400' },
      { key: '!', icon: Flag, description: 'Mark important', color: 'text-orange-400' },
    ]
  },
  {
    category: 'Compose',
    actions: [
      { key: 'c', icon: MessageSquare, description: 'Compose new', color: 'text-green-400' },
      { key: 'Ctrl+Enter', icon: MessageSquare, description: 'Send email', color: 'text-green-400' },
      { key: 'Esc', icon: X, description: 'Close composer', color: 'text-gray-400' },
    ]
  },
  {
    category: 'General',
    actions: [
      { key: '/', icon: Search, description: 'Search emails', color: 'text-indigo-400' },
      { key: 'g+i', icon: Archive, description: 'Go to Inbox', color: 'text-gray-400' },
      { key: 'g+s', icon: Star, description: 'Go to Starred', color: 'text-gray-400' },
      { key: '?', icon: Keyboard, description: 'Show shortcuts', color: 'text-gray-400' },
    ]
  }
];

export function EmailQuickActions() {
  const [isVisible, setIsVisible] = useState(false);
  const [recentAction, setRecentAction] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Show shortcuts panel
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Don't show if typing in input/textarea
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        setIsVisible(true);
      }
      
      // Hide shortcuts panel
      if (e.key === 'Escape') {
        setIsVisible(false);
      }

      // Track recent actions for visual feedback
      if (!e.target || (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))) {
        const actionKey = e.key.toLowerCase();
        const foundAction = shortcuts
          .flatMap(category => category.actions)
          .find(action => action.key.toLowerCase() === actionKey || action.key.toLowerCase().includes(actionKey));
        
        if (foundAction) {
          setRecentAction(actionKey);
          setTimeout(() => setRecentAction(null), 2000);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <>
      {/* Recent Action Indicator */}
      <AnimatePresence>
        {recentAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-20 right-6 z-40"
          >
            <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-800/50 rounded-lg px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800/50 rounded text-xs font-mono text-gray-300">
                  {recentAction}
                </kbd>
                <span className="text-sm text-gray-400">pressed</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shortcuts Panel */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsVisible(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center">
                      <Keyboard className="w-5 h-5 text-[#37bd7e]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
                      <p className="text-sm text-gray-400">Master your email workflow</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsVisible(false)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </motion.button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {shortcuts.map((category, categoryIndex) => (
                    <motion.div
                      key={category.category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: categoryIndex * 0.1 }}
                      className="space-y-4"
                    >
                      <h3 className="text-lg font-semibold text-white border-b border-gray-800/50 pb-2">
                        {category.category}
                      </h3>
                      <div className="space-y-3">
                        {category.actions.map((action, actionIndex) => (
                          <motion.div
                            key={`${action.key}-${action.description}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (categoryIndex * 0.1) + (actionIndex * 0.05) }}
                            className={cn(
                              'flex items-center gap-4 p-3 rounded-lg transition-all duration-200',
                              recentAction === action.key.toLowerCase()
                                ? 'bg-[#37bd7e]/20 border border-[#37bd7e]/30 scale-105'
                                : 'bg-gray-800/30 hover:bg-gray-800/50'
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <action.icon className={cn('w-4 h-4', action.color)} />
                              <span className="text-sm text-gray-200 font-medium">
                                {action.description}
                              </span>
                            </div>
                            <kbd className={cn(
                              'px-3 py-1.5 bg-gray-700/50 rounded text-xs font-mono border border-gray-600/50',
                              recentAction === action.key.toLowerCase()
                                ? 'bg-[#37bd7e]/20 border-[#37bd7e]/50 text-[#37bd7e]'
                                : 'text-gray-300'
                            )}>
                              {action.key}
                            </kbd>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Tips */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 p-4 bg-gradient-to-r from-[#37bd7e]/10 to-purple-500/10 rounded-lg border border-[#37bd7e]/20"
                >
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <MoreHorizontal className="w-4 h-4 text-[#37bd7e]" />
                    Pro Tips
                  </h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Use <kbd className="px-1 bg-gray-700/50 rounded text-xs">Tab</kbd> to navigate between compose fields</li>
                    <li>• Hold <kbd className="px-1 bg-gray-700/50 rounded text-xs">Shift</kbd> while pressing shortcuts for bulk actions</li>
                    <li>• Press <kbd className="px-1 bg-gray-700/50 rounded text-xs">?</kbd> anytime to see this guide</li>
                    <li>• Shortcuts work even when not focused on email list</li>
                  </ul>
                </motion.div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-800/50 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Press <kbd className="px-2 py-1 bg-gray-800/50 rounded text-xs">?</kbd> anytime to toggle this guide
                </div>
                <div className="text-sm text-gray-400">
                  Inspired by Superhuman ⚡
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Shortcut Hint */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2 }}
        className="fixed bottom-4 left-4 z-30"
      >
        <motion.button
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsVisible(true)}
          className="p-3 bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          <Keyboard className="w-5 h-5 text-gray-400 group-hover:text-[#37bd7e] transition-colors" />
        </motion.button>
      </motion.div>
    </>
  );
}