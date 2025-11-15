/**
 * Action Buttons Component
 * Shared component for rendering quick actions across all response types
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { QuickActionResponse } from './types';
import * as Icons from 'lucide-react';

interface ActionButtonsProps {
  actions: QuickActionResponse[];
  onActionClick?: (action: QuickActionResponse) => void;
}

const getIcon = (iconName?: string) => {
  if (!iconName) return null;
  const IconComponent = (Icons as any)[iconName] || (Icons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1)];
  return IconComponent || null;
};

export const ActionButtons: React.FC<ActionButtonsProps> = ({ actions, onActionClick }) => {
  if (!actions || actions.length === 0) return null;

  const handleClick = async (action: QuickActionResponse) => {
    if (onActionClick) {
      onActionClick(action);
      return;
    }

    if (!action.callback) {
      return;
    }

    // Handle API callbacks
    if (action.callback.startsWith('/api/')) {
      try {
        const response = await fetch(action.callback, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(action.params || {})
        });
        
        if (response.ok) {
          const result = await response.json();
          // Show success notification or handle result
        } else {
        }
      } catch (error) {
      }
      return;
    }

    // Handle external URLs
    if (action.callback.startsWith('http')) {
      window.open(action.callback, '_blank');
      return;
    }

    // Handle internal routes
    if (action.callback.startsWith('/')) {
      window.location.href = action.callback;
      return;
    }
  };

  return (
    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-800/50">
      {actions.map(action => {
        const Icon = action.icon ? getIcon(action.icon) : null;
        
        return (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              action.type === 'primary' && 'bg-blue-600 hover:bg-blue-700 text-white',
              action.type === 'secondary' && 'bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 hover:bg-gray-900/50 text-gray-300',
              action.type === 'tertiary' && 'text-gray-400 hover:text-gray-300'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

export default ActionButtons;

