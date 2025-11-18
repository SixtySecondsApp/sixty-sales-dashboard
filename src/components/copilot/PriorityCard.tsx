/**
 * Priority Card Component
 * Displays individual recommendation cards with actions
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Recommendation } from './types';
import { Mail, Phone, Eye, ArrowRight } from 'lucide-react';

interface PriorityCardProps {
  recommendation: Recommendation;
  onActionClick?: (action: Recommendation['actions'][0]) => void;
}

const getActionIcon = (type: Recommendation['actions'][0]['type']) => {
  switch (type) {
    case 'draft_email':
      return Mail;
    case 'schedule_call':
      return Phone;
    case 'view_deal':
    case 'view_contact':
    case 'view_brief':
      return Eye;
    default:
      return ArrowRight;
  }
};

export const PriorityCard: React.FC<PriorityCardProps> = ({
  recommendation,
  onActionClick
}) => {
  const priorityColors = [
    'from-blue-500 to-blue-600',
    'from-amber-500 to-amber-600',
    'from-purple-500 to-purple-600'
  ];

  const colorClass = priorityColors[recommendation.priority - 1] || priorityColors[0];

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-gray-700/50 transition-all">
      <div className="flex items-start gap-4">
        {/* Priority Badge */}
        <div
          className={cn(
            'w-10 h-10 bg-gradient-to-br rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0',
            colorClass
          )}
        >
          {recommendation.priority}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-100 mb-1">
            {recommendation.title}
          </h3>
          <p className="text-sm text-gray-400 mb-4">{recommendation.description}</p>

          {/* Tags */}
          {recommendation.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {recommendation.tags.map(tag => (
                <span
                  key={tag.id}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    `bg-${tag.color}/10 border border-${tag.color}/20 text-${tag.color}-400`
                  )}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          {recommendation.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recommendation.actions.map(action => {
                const Icon = getActionIcon(action.type);
                return (
                  <Button
                    key={action.id}
                    onClick={() => onActionClick?.(action)}
                    variant={action.variant === 'primary' ? 'default' : 'outline'}
                    className={cn(
                      'text-sm',
                      action.variant === 'primary'
                        ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20'
                        : 'bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50'
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriorityCard;
