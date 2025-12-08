import { Task, Company, UserProfile } from '@/lib/database/models';

// Company group with tasks
export interface CompanyTaskGroup {
  id: string;
  company: Company | null;
  name: string;
  tasks: Task[];
  color: string;
  accentColor: 'blue' | 'emerald' | 'amber' | 'purple' | 'pink' | 'gray';
  collapsed: boolean;
}

// Status configuration for visual styling
export interface StatusConfig {
  label: string;
  bg: string;
  bgLight: string;
  text: string;
  textLight: string;
  glow: string;
}

// Priority configuration
export interface PriorityConfig {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
}

// View modes
export type ProjectViewMode = 'table' | 'kanban';

// Filter state
export interface ProjectFilters {
  search: string;
  status: Task['status'] | 'all';
  priority: Task['priority'] | 'all';
  assignee: string | 'all';
}

// Sort options
export type SortField = 'due_date' | 'priority' | 'status' | 'title' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface ProjectSort {
  field: SortField;
  direction: SortDirection;
}

// Status configurations with glassmorphic styling
export const statusConfigs: Record<Task['status'], StatusConfig> = {
  pending: {
    label: 'Pending',
    bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50 border border-amber-200',
    text: 'text-white',
    textLight: 'text-amber-700',
    glow: 'shadow-amber-500/30'
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50 border border-blue-200',
    text: 'text-white',
    textLight: 'text-blue-700',
    glow: 'shadow-blue-500/30'
  },
  completed: {
    label: 'Completed',
    bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
    bgLight: 'bg-emerald-50 border border-emerald-200',
    text: 'text-white',
    textLight: 'text-emerald-700',
    glow: 'shadow-emerald-500/30'
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-gray-500/50',
    bgLight: 'bg-gray-100 border border-gray-200',
    text: 'text-white',
    textLight: 'text-gray-600',
    glow: ''
  },
  overdue: {
    label: 'Overdue',
    bg: 'bg-gradient-to-r from-red-500 to-rose-500',
    bgLight: 'bg-red-50 border border-red-200',
    text: 'text-white',
    textLight: 'text-red-700',
    glow: 'shadow-red-500/30'
  }
};

// Priority configurations
export const priorityConfigs: Record<Task['priority'], PriorityConfig> = {
  low: {
    label: 'Low',
    color: '#6B7280',
    bgClass: 'bg-gray-500/20 dark:bg-gray-500/20',
    textClass: 'text-gray-600 dark:text-gray-400'
  },
  medium: {
    label: 'Medium',
    color: '#F59E0B',
    bgClass: 'bg-amber-500/20 dark:bg-amber-500/20',
    textClass: 'text-amber-600 dark:text-amber-400'
  },
  high: {
    label: 'High',
    color: '#EF4444',
    bgClass: 'bg-red-500/20 dark:bg-red-500/20',
    textClass: 'text-red-600 dark:text-red-400'
  },
  urgent: {
    label: 'Urgent',
    color: '#DC2626',
    bgClass: 'bg-red-600/20 dark:bg-red-600/20',
    textClass: 'text-red-700 dark:text-red-300'
  }
};

// Accent color gradients
export const accentColors: Record<CompanyTaskGroup['accentColor'], { gradient: string; glow: string }> = {
  blue: { gradient: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-500/20' },
  emerald: { gradient: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-500/20' },
  amber: { gradient: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/20' },
  purple: { gradient: 'from-purple-500 to-violet-500', glow: 'shadow-purple-500/20' },
  pink: { gradient: 'from-pink-500 to-rose-500', glow: 'shadow-pink-500/20' },
  gray: { gradient: 'from-gray-500 to-gray-600', glow: '' }
};

// Helper to get accent color based on company index
export function getAccentColor(index: number): CompanyTaskGroup['accentColor'] {
  const colors: CompanyTaskGroup['accentColor'][] = ['blue', 'emerald', 'amber', 'purple', 'pink'];
  return colors[index % colors.length];
}

