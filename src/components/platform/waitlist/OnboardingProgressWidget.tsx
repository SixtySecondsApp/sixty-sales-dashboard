/**
 * OnboardingProgressWidget Component
 * Displays user onboarding progress with expandable details
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Clock } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/services/onboardingService';
import {
  getAllOnboardingSteps,
  getCompletionBadgeColor,
  getDaysStuck,
} from '@/lib/services/onboardingService';

export interface OnboardingProgressWidgetProps {
  progress: OnboardingProgress | null;
  variant?: 'badge' | 'inline' | 'detailed';
  showExpanded?: boolean;
  className?: string;
}

export function OnboardingProgressWidget({
  progress,
  variant = 'badge',
  showExpanded = false,
  className = '',
}: OnboardingProgressWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(showExpanded);

  if (!progress) {
    return variant === 'badge' ? (
      <span className="text-xs text-gray-500 dark:text-gray-400">No data</span>
    ) : null;
  }

  const percentage = progress.completion_percentage;
  const allSteps = getAllOnboardingSteps();
  const badgeColor = getCompletionBadgeColor(percentage);
  const daysStuck = getDaysStuck(progress);

  // Badge variant - compact pill
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span
          className={`
            inline-flex items-center gap-1.5
            px-2.5 py-1
            ${badgeColor}
            text-white
            rounded-full
            text-xs font-medium
          `}
        >
          {percentage}%
        </span>
        {daysStuck && (
          <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Stuck {daysStuck}d
          </span>
        )}
      </div>
    );
  }

  // Inline variant - progress bar
  if (variant === 'inline') {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            {progress.completed_steps} / {progress.total_steps} steps
          </span>
          <span className="font-medium text-gray-900 dark:text-white">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${badgeColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {daysStuck && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            User stuck for {daysStuck} days
          </div>
        )}
      </div>
    );
  }

  // Detailed variant - full checklist with expand/collapse
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Summary header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Onboarding Progress
              </span>
              <span className={`px-2 py-0.5 ${badgeColor} text-white rounded-full text-xs`}>
                {percentage}%
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {progress.completed_steps} of {progress.total_steps} steps completed
            </div>
          </div>
        </div>
        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${badgeColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </button>

      {/* Expanded checklist */}
      {isExpanded && (
        <div className="space-y-2 pl-7">
          {allSteps.map((step) => {
            const stepKey = `${step.step}_at` as keyof OnboardingProgress;
            const isCompleted = !!progress[stepKey];
            const completedDate = progress[stepKey] as string | undefined;

            return (
              <div
                key={step.step}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border
                  ${
                    isCompleted
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      isCompleted
                        ? 'text-green-900 dark:text-green-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      isCompleted
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.description}
                  </div>
                  {isCompleted && completedDate && (
                    <div className="text-xs text-green-600 dark:text-green-500 mt-1">
                      Completed {new Date(completedDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Warning for stuck users */}
          {daysStuck && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    User needs help
                  </div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                    Stuck at {percentage}% completion for {daysStuck} days
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
