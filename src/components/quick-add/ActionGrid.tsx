import { motion } from 'framer-motion';
import { Target, CheckSquare, PoundSterling, Phone, Users, FileText } from 'lucide-react';
import type { QuickAction } from './types';

interface ActionGridProps {
  onActionSelect: (actionId: string) => void;
}

const quickActions: QuickAction[] = [
  { id: 'deal', icon: Target, label: 'Create Deal', color: 'purple' },
  { id: 'task', icon: CheckSquare, label: 'Add Task', color: 'indigo' },
  { id: 'sale', icon: PoundSterling, label: 'Add Sale', color: 'emerald' },
  { id: 'outbound', icon: Phone, label: 'Add Outbound', color: 'blue' },
  { id: 'meeting', icon: Users, label: 'Add Meeting', color: 'violet' },
  { id: 'proposal', icon: FileText, label: 'Add Proposal', color: 'orange' },
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
              ? 'bg-blue-400/5'
              : action.color === 'orange'
                ? 'bg-orange-500/10'
                : action.color === 'indigo'
                  ? 'bg-indigo-500/10'
                  : action.color === 'purple'
                    ? 'bg-purple-500/10'
                    : `bg-${action.color}-500/10`
          } border ${
            action.color === 'blue'
              ? 'border-blue-500/10'
              : action.color === 'orange'
                ? 'border-orange-500/20'
                : action.color === 'indigo'
                  ? 'border-indigo-500/20'
                  : action.color === 'purple'
                    ? 'border-purple-500/20'
                    : `border-${action.color}-500/20`
          } hover:bg-${action.color}-500/20 transition-all duration-300 group backdrop-blur-sm`}
        >
          <div className={`p-3 rounded-xl ${
            action.color === 'blue'
              ? 'bg-blue-400/5'
              : action.color === 'orange'
                ? 'bg-orange-500/10'
                : action.color === 'indigo'
                  ? 'bg-indigo-500/10'
                  : action.color === 'purple'
                    ? 'bg-purple-500/10'
                    : `bg-${action.color}-500/10`
          } transition-all duration-300 group-hover:scale-110 group-hover:bg-${action.color}-500/20 ring-1 ${
            action.color === 'blue'
              ? 'ring-blue-500/50 group-hover:ring-blue-500/60'
              : action.color === 'orange'
                ? 'ring-orange-500/30 group-hover:ring-orange-500/50'
                : action.color === 'indigo'
                  ? 'ring-indigo-500/30 group-hover:ring-indigo-500/50'
                  : action.color === 'purple'
                    ? 'ring-purple-500/30 group-hover:ring-purple-500/50'
                    : `ring-${action.color}-500/30 group-hover:ring-${action.color}-500/50`
          } backdrop-blur-sm mb-3`}>
            <action.icon className={`w-6 h-6 ${
              action.color === 'blue'
                ? 'text-blue-500'
                : action.color === 'orange'
                  ? 'text-orange-500'
                  : action.color === 'indigo'
                    ? 'text-indigo-500'
                    : action.color === 'purple'
                      ? 'text-purple-500'
                      : `text-${action.color}-500`
            }`} />
          </div>
          <span className="text-sm font-medium text-white/90">{action.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}