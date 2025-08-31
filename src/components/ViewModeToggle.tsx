import React from 'react';
import { motion } from 'framer-motion';
import { Grid3X3, List } from 'lucide-react';

interface ViewModeToggleProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  variant?: 'default' | 'compact';
  size?: 'sm' | 'md' | 'lg';
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  viewMode,
  onViewModeChange,
  variant = 'default',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center bg-gray-800/50 rounded-lg p-1">
        <motion.button
          onClick={() => onViewModeChange('grid')}
          className={`${sizeClasses[size]} rounded transition-all duration-200 ${
            viewMode === 'grid' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'text-gray-400 hover:text-white'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Grid3X3 className={iconSizes[size]} />
        </motion.button>
        <motion.button
          onClick={() => onViewModeChange('list')}
          className={`${sizeClasses[size]} rounded transition-all duration-200 ${
            viewMode === 'list' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'text-gray-400 hover:text-white'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <List className={iconSizes[size]} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex items-center bg-gray-800/50 rounded-lg p-1 relative">
      {/* Active background */}
      <motion.div
        className="absolute bg-emerald-500/20 rounded transition-all duration-300"
        animate={{
          x: viewMode === 'grid' ? 0 : '50%',
          width: '50%'
        }}
        style={{
          height: 'calc(100% - 8px)',
          top: '4px',
          left: '4px'
        }}
      />
      
      <motion.button
        onClick={() => onViewModeChange('grid')}
        className={`relative z-10 ${sizeClasses[size]} rounded transition-all duration-200 flex items-center gap-2 ${
          viewMode === 'grid' 
            ? 'text-emerald-400' 
            : 'text-gray-400 hover:text-white'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Grid3X3 className={iconSizes[size]} />
        <span className="text-sm font-medium">Grid</span>
      </motion.button>
      
      <motion.button
        onClick={() => onViewModeChange('list')}
        className={`relative z-10 ${sizeClasses[size]} rounded transition-all duration-200 flex items-center gap-2 ${
          viewMode === 'list' 
            ? 'text-emerald-400' 
            : 'text-gray-400 hover:text-white'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <List className={iconSizes[size]} />
        <span className="text-sm font-medium">List</span>
      </motion.button>
    </div>
  );
};

export default ViewModeToggle;