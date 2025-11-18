/**
 * Tool Call Indicator Component
 * Visualizes tool execution with animated progress states
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Database,
  Mail,
  Calendar,
  Users,
  Activity,
  CheckCircle2,
  FileText,
  BarChart3,
  Lightbulb,
  Target,
  LucideIcon
} from 'lucide-react';
import type { ToolCall, ToolStep, ToolState, ToolType } from './types';

interface ToolCallIndicatorProps {
  toolCall: ToolCall;
  onComplete?: (result: any) => void;
  compact?: boolean;
  preview?: string[];
}

interface ToolConfig {
  icon: LucideIcon;
  label: string;
  gradient: string;
  iconColor: string;
  glowColor: string;
}

const toolConfig: Record<ToolType, ToolConfig> = {
  task_search: {
    icon: Activity,
    label: 'Task Search',
    gradient: 'from-violet-500 via-violet-600 to-violet-700',
    iconColor: 'text-violet-400',
    glowColor: 'shadow-violet-500/20'
  },
  pipeline_data: {
    icon: Activity,
    label: 'Pipeline Analysis',
    gradient: 'from-blue-500 via-blue-600 to-blue-700',
    iconColor: 'text-blue-400',
    glowColor: 'shadow-blue-500/20'
  },
  email_draft: {
    icon: Mail,
    label: 'Email Generation',
    gradient: 'from-purple-500 via-purple-600 to-purple-700',
    iconColor: 'text-purple-400',
    glowColor: 'shadow-purple-500/20'
  },
  calendar_search: {
    icon: Calendar,
    label: 'Calendar Search',
    gradient: 'from-emerald-500 via-emerald-600 to-emerald-700',
    iconColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/20'
  },
  contact_lookup: {
    icon: Users,
    label: 'Contact Lookup',
    gradient: 'from-amber-500 via-amber-600 to-amber-700',
    iconColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/20'
  },
  contact_search: {
    icon: Users,
    label: 'Contact Search',
    gradient: 'from-cyan-500 via-cyan-600 to-cyan-700',
    iconColor: 'text-cyan-400',
    glowColor: 'shadow-cyan-500/20'
  },
  deal_health: {
    icon: Activity,
    label: 'Health Analysis',
    gradient: 'from-rose-500 via-rose-600 to-rose-700',
    iconColor: 'text-rose-400',
    glowColor: 'shadow-rose-500/20'
  },
  meeting_analysis: {
    icon: Calendar,
    label: 'Meeting Analysis',
    gradient: 'from-indigo-500 via-indigo-600 to-indigo-700',
    iconColor: 'text-indigo-400',
    glowColor: 'shadow-indigo-500/20'
  },
  roadmap_create: {
    icon: FileText,
    label: 'Roadmap Creation',
    gradient: 'from-teal-500 via-teal-600 to-teal-700',
    iconColor: 'text-teal-400',
    glowColor: 'shadow-teal-500/20'
  },
  sales_coach: {
    icon: BarChart3,
    label: 'Sales Coach',
    gradient: 'from-orange-500 via-orange-600 to-orange-700',
    iconColor: 'text-orange-400',
    glowColor: 'shadow-orange-500/20'
  }
};

function getStateLabel(state: ToolState): string {
  const labels: Record<ToolState, string> = {
    initiating: 'Starting...',
    fetching: 'Retrieving data...',
    processing: 'Analyzing...',
    completing: 'Finalizing...',
    complete: 'Complete'
  };
  return labels[state];
}

function getProgress(toolCall: ToolCall): number {
  if (toolCall.state === 'complete') return 100;

  const completedSteps = toolCall.steps.filter(s => s.state === 'complete').length;
  const totalSteps = toolCall.steps.length;

  if (totalSteps === 0) {
    const stateProgress: Record<ToolState, number> = {
      initiating: 20,
      fetching: 40,
      processing: 70,
      completing: 90,
      complete: 100
    };
    return stateProgress[toolCall.state];
  }

  return (completedSteps / totalSteps) * 100;
}

function getStepIcon(iconName: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    database: Database,
    mail: Mail,
    calendar: Calendar,
    users: Users,
    activity: Activity,
    'file-text': FileText,
    'check-circle': CheckCircle2,
    'bar-chart': BarChart3,
    lightbulb: Lightbulb,
    target: Target
  };
  return icons[iconName] || Activity;
}

function formatMetadata(metadata: Record<string, any>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' • ');
}

// Individual Step Component
function ToolStepComponent({ step, isLast }: { step: ToolStep; isLast: boolean }) {
  const StepIcon = getStepIcon(step.icon);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 relative"
    >
      {/* Connecting Line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 w-0.5 h-full bg-gradient-to-b from-gray-300 dark:from-gray-700/50 to-transparent" />
      )}

      {/* Icon */}
      <div className="relative z-10">
        <motion.div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${
            step.state === 'complete'
              ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
              : step.state === 'active'
              ? 'bg-blue-500 shadow-lg shadow-blue-500/30'
              : 'bg-gray-200 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600/50'
          }`}
          animate={
            step.state === 'active'
              ? { 
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(59, 130, 246, 0.5)',
                    '0 0 0 8px rgba(59, 130, 246, 0)',
                    '0 0 0 0 rgba(59, 130, 246, 0)'
                  ]
                }
              : {}
          }
          transition={{ 
            duration: 1.5, 
            repeat: step.state === 'active' ? Infinity : 0,
            ease: "easeInOut"
          }}
        >
          {step.state === 'complete' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          ) : step.state === 'active' ? (
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          ) : (
            <StepIcon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
          )}
        </motion.div>
      </div>

      {/* Label */}
      <div className="flex-1 pt-0.5 pb-2">
        <div
          className={`text-sm transition-colors duration-200 ${
            step.state === 'complete'
              ? 'text-gray-700 dark:text-gray-300'
              : step.state === 'active'
              ? 'text-gray-900 dark:text-gray-100 font-medium'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {step.label}
        </div>

        {/* Metadata */}
        {step.metadata && step.state === 'complete' && Object.keys(step.metadata).length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-xs text-emerald-600 dark:text-emerald-400/80 mt-1 flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{formatMetadata(step.metadata)}</span>
          </motion.div>
        )}

        {/* Duration */}
        {step.duration && step.state === 'complete' && (
          <div className="text-xs text-gray-500 dark:text-gray-600 mt-0.5">{Math.round(step.duration)}ms</div>
        )}
      </div>
    </motion.div>
  );
}

// Main Tool Call Indicator Component
export function ToolCallIndicator({
  toolCall,
  onComplete,
  compact = false,
  preview
}: ToolCallIndicatorProps) {
  const config = toolConfig[toolCall.tool];
  const Icon = config.icon;
  const isComplete = toolCall.state === 'complete';

  // Compact mode for multiple tool calls
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-900/70 backdrop-blur-sm border border-gray-200 dark:border-gray-800/50 rounded-xl shadow-sm dark:shadow-none"
      >
        <motion.div
          animate={isComplete ? {} : { rotate: 360 }}
          transition={{ duration: 2, repeat: isComplete ? 0 : Infinity, ease: 'linear' }}
          className={`${config.iconColor}`}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
        <span className="text-sm text-gray-900 dark:text-gray-300 font-medium">{config.label}</span>
        {!isComplete && <Loader2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 animate-spin" />}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="my-2"
    >
      <div className="bg-white dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 shadow-lg dark:shadow-xl dark:shadow-black/20 overflow-hidden relative">
        {/* Animated background gradient */}
        {!isComplete && (
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-5`}
            animate={{
              x: ['0%', '100%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        )}

        {/* Header */}
        <div className="flex items-center gap-4 mb-5 relative z-10">
          <motion.div
            className={`w-12 h-12 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center shadow-lg ${config.glowColor} relative overflow-hidden`}
            animate={isComplete ? {} : { 
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Shimmer effect */}
            {!isComplete && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  repeatDelay: 1
                }}
              />
            )}
            <Icon className="w-6 h-6 text-white relative z-10" />
          </motion.div>

          <div className="flex-1">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{config.label}</div>
            <div className="text-xs text-gray-600 dark:text-gray-500 mt-0.5 flex items-center gap-2">
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Complete</span>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </motion.div>
                  <span>{getStateLabel(toolCall.state)}</span>
                </>
              )}
            </div>
          </div>

          {isComplete && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            </motion.div>
          )}
        </div>

        {/* Progress Steps */}
        {toolCall.steps && toolCall.steps.length > 0 && (
          <div className="space-y-1 mb-4 relative z-10">
            {toolCall.steps.map((step, index) => (
              <ToolStepComponent
                key={step.id}
                step={step}
                isLast={index === toolCall.steps.length - 1}
              />
            ))}
          </div>
        )}

        {/* Progress Bar */}
        {!isComplete && (
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 dark:text-gray-500 font-medium">Progress</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{Math.round(getProgress(toolCall))}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-800/80 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div
                className={`h-full bg-gradient-to-r ${config.gradient} shadow-lg ${config.glowColor} relative`}
                initial={{ width: '0%' }}
                animate={{ width: `${getProgress(toolCall)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                {/* Animated shimmer on progress bar */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                />
              </motion.div>
            </div>
          </div>
        )}

        {/* Streaming Preview */}
        {preview && preview.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800/50 relative z-10"
          >
            <div className="text-xs text-gray-600 dark:text-gray-500 mb-3 font-medium flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </div>
            <div className="space-y-2">
              {preview.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-sm text-gray-700 dark:text-gray-400 pl-4 py-2 border-l-2 border-blue-500/30 bg-blue-50 dark:bg-blue-500/5 rounded-r-lg backdrop-blur-sm"
                >
                  {item}
                </motion.div>
              ))}
              {toolCall.state !== 'complete' && (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs text-gray-500 dark:text-gray-600 pl-4 flex items-center gap-2"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading more...</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Streaming Tool Call Component
export function StreamingToolCall({
  toolCall,
  preview
}: {
  toolCall: ToolCall;
  preview?: string[];
}) {
  return <ToolCallIndicator toolCall={toolCall} preview={preview} />;
}

// Compact Tool Call Indicator (for multiple tool calls)
export function CompactToolCallIndicator({ toolCall }: { toolCall: ToolCall }) {
  return <ToolCallIndicator toolCall={toolCall} compact={true} />;
}
