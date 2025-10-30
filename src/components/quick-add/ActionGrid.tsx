import { motion } from 'framer-motion';
import { Map, CheckSquare, PoundSterling, Phone, Users, FileText } from 'lucide-react';
import type { QuickAction } from './types';

interface ActionGridProps {
  onActionSelect: (actionId: string) => void;
}

const quickActions: QuickAction[] = [
  { id: 'outbound', icon: Phone, label: 'Add Outbound', color: 'blue' },
  { id: 'meeting', icon: Users, label: 'Add Meeting', color: 'violet' },
  { id: 'proposal', icon: FileText, label: 'Add Proposal', color: 'orange' },
  { id: 'sale', icon: PoundSterling, label: 'Add Sale', color: 'emerald' },
  { id: 'task', icon: CheckSquare, label: 'Add Task', color: 'indigo' },
  { id: 'roadmap', icon: Map, label: 'Add Roadmap', color: 'purple' },
];

export function ActionGrid({ onActionSelect }: ActionGridProps) {
  const handleActionClick = (actionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onActionSelect(actionId);
  };

  return (
    <motion.div 
      className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
      variants={{
        show: {
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
      initial="hidden"
      animate="show"
    >
      {quickActions.map((action) => (
        <motion.button
          key={action.id}
          type="button"
          variants={{
            hidden: { y: 20, opacity: 0 },
            show: { y: 0, opacity: 1 }
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => handleActionClick(action.id, e)}
          className={`flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl ${
            action.color === 'blue'
              ? 'bg-blue-50 dark:bg-blue-400/5 border-blue-200 dark:border-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20'
              : action.color === 'orange'
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 hover:bg-orange-100 dark:hover:bg-orange-500/20'
                : action.color === 'indigo'
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                  : action.color === 'purple'
                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 hover:bg-purple-100 dark:hover:bg-purple-500/20'
                    : action.color === 'emerald'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                      : action.color === 'violet'
                        ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/20'
                        : `bg-${action.color}-50 dark:bg-${action.color}-500/10`
          } border transition-all duration-300 group backdrop-blur-sm`}
        >
          <div className={`p-3 rounded-xl ${
            action.color === 'blue'
              ? 'bg-blue-100 dark:bg-blue-400/5 ring-1 ring-blue-300 dark:ring-blue-500/50'
              : action.color === 'orange'
                ? 'bg-orange-100 dark:bg-orange-500/10 ring-1 ring-orange-300 dark:ring-orange-500/30'
                : action.color === 'indigo'
                  ? 'bg-indigo-100 dark:bg-indigo-500/10 ring-1 ring-indigo-300 dark:ring-indigo-500/30'
                  : action.color === 'purple'
                    ? 'bg-purple-100 dark:bg-purple-500/10 ring-1 ring-purple-300 dark:ring-purple-500/30'
                    : action.color === 'emerald'
                      ? 'bg-emerald-100 dark:bg-emerald-500/10 ring-1 ring-emerald-300 dark:ring-emerald-500/30'
                      : action.color === 'violet'
                        ? 'bg-violet-100 dark:bg-violet-500/10 ring-1 ring-violet-300 dark:ring-violet-500/30'
                        : `bg-${action.color}-100 dark:bg-${action.color}-500/10`
          } transition-all duration-300 group-hover:scale-110 group-hover:ring-2 backdrop-blur-sm mb-3`}>
            <action.icon className={`w-6 h-6 ${
              action.color === 'blue'
                ? 'text-blue-600 dark:text-blue-500'
                : action.color === 'orange'
                  ? 'text-orange-600 dark:text-orange-500'
                  : action.color === 'indigo'
                    ? 'text-indigo-600 dark:text-indigo-500'
                    : action.color === 'purple'
                      ? 'text-purple-600 dark:text-purple-500'
                      : action.color === 'emerald'
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : action.color === 'violet'
                          ? 'text-violet-600 dark:text-violet-500'
                          : `text-${action.color}-600 dark:text-${action.color}-500`
            }`} />
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{action.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}