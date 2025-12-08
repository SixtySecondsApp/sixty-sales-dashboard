import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface AddTaskRowProps {
  isDark: boolean;
  onClick: () => void;
}

export function AddTaskRow({ isDark, onClick }: AddTaskRowProps) {
  return (
    <div className={`flex items-center border-t ${isDark ? 'border-gray-800/50 bg-gray-900/40' : 'border-gray-200/50 bg-gray-50/40'}`}>
      {/* Checkbox column */}
      <div className="w-12 flex-shrink-0" />
      
      {/* Expand column */}
      <div className="w-10 flex-shrink-0" />

      {/* Add task button */}
      <div className="flex-1 px-4 py-3">
        <motion.button
          whileHover={{ x: 4 }}
          onClick={onClick}
          className={`flex items-center gap-2 text-sm transition-colors
                     ${isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-600 hover:text-blue-500'}`}
        >
          <Plus className="w-4 h-4" />
          Add task
        </motion.button>
      </div>
    </div>
  );
}

