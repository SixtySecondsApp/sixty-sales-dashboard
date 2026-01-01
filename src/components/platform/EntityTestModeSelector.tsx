/**
 * EntityTestModeSelector
 *
 * Toggle component for selecting test mode (none, good, average, bad, custom)
 * with entity-type-specific descriptions.
 */

import { User, UserCheck, UserMinus, UserX, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type EntityType,
  type EntityTestMode,
  MODE_DESCRIPTIONS,
} from '@/lib/utils/entityTestTypes';

interface EntityTestModeSelectorProps {
  entityType: EntityType;
  mode: EntityTestMode;
  onChange: (mode: EntityTestMode) => void;
  disabled?: boolean;
}

const MODE_CONFIG: Record<
  EntityTestMode,
  {
    label: string;
    icon: React.ElementType;
    colorClass: string;
    activeColorClass: string;
  }
> = {
  none: {
    label: 'None',
    icon: User,
    colorClass: 'text-gray-500 dark:text-gray-400',
    activeColorClass: 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
  },
  good: {
    label: 'Good',
    icon: UserCheck,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    activeColorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  average: {
    label: 'Average',
    icon: UserMinus,
    colorClass: 'text-amber-600 dark:text-amber-400',
    activeColorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  bad: {
    label: 'Bad',
    icon: UserX,
    colorClass: 'text-red-600 dark:text-red-400',
    activeColorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  custom: {
    label: 'Custom',
    icon: Search,
    colorClass: 'text-blue-600 dark:text-blue-400',
    activeColorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

const MODE_ORDER: EntityTestMode[] = ['none', 'good', 'average', 'bad', 'custom'];

export function EntityTestModeSelector({
  entityType,
  mode,
  onChange,
  disabled = false,
}: EntityTestModeSelectorProps) {
  const descriptions = MODE_DESCRIPTIONS[entityType];

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Quality Tier
      </label>
      <div className="flex flex-wrap gap-1.5 bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded-lg">
        {MODE_ORDER.map((key) => {
          const config = MODE_CONFIG[key];
          const Icon = config.icon;
          const isActive = mode === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isActive
                  ? config.activeColorClass
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
              )}
              title={descriptions[key]}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? '' : config.colorClass)} />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {descriptions[mode]}
      </p>
    </div>
  );
}

// Re-export types for convenience
export type { EntityTestMode };
