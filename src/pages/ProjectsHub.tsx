import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Layers } from 'lucide-react';

import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';
import { Task, Company } from '@/lib/database/models';
import TaskForm from '@/components/TaskForm';

import { ProjectsToolbar } from '@/components/projects/ProjectsToolbar';
import { CompanyTaskGroup } from '@/components/projects/CompanyTaskGroup';
import { ProjectsKanbanView } from '@/components/projects/ProjectsKanbanView';
import {
  CompanyTaskGroup as CompanyTaskGroupType,
  ProjectViewMode,
  ProjectFilters,
  ProjectSort,
  getAccentColor
} from '@/components/projects/types';

// Loading skeleton component
function ProjectsSkeleton({ isDark }: { isDark: boolean }) {
  const skeletonColors = {
    bg: isDark ? 'bg-gray-900/80' : 'bg-white',
    border: isDark ? 'border-gray-700/50' : 'border-gray-200',
    element: isDark ? 'bg-gray-800' : 'bg-gray-200',
  };

  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`backdrop-blur-sm rounded-2xl p-6 border animate-pulse
                      ${skeletonColors.bg} ${skeletonColors.border}`}
        >
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-8 h-8 rounded-lg ${skeletonColors.element}`} />
            <div className={`h-6 w-48 rounded-lg ${skeletonColors.element}`} />
            <div className={`h-5 w-16 rounded-full ${skeletonColors.element}`} />
          </div>
          {/* Row skeletons */}
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded ${skeletonColors.element}`} />
                <div className={`h-4 flex-1 rounded ${skeletonColors.element}`} />
                <div className={`h-4 w-24 rounded ${skeletonColors.element}`} />
                <div className={`h-4 w-20 rounded ${skeletonColors.element}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state component
function EmptyState({ isDark, onCreateTask }: { isDark: boolean; onCreateTask: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-20 px-6 rounded-2xl border-2 border-dashed
                  ${isDark 
                    ? 'border-gray-800 bg-gray-900/40' 
                    : 'border-gray-200 bg-gray-50/40'}`}
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6
                      ${isDark 
                        ? 'bg-gray-800/50 text-gray-500' 
                        : 'bg-gray-100 text-gray-400'}`}>
        <Layers className="w-8 h-8" />
      </div>
      <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        No tasks yet
      </h3>
      <p className={`text-center max-w-md mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Create your first task to get started. Tasks will be automatically grouped by company.
      </p>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCreateTask}
        className="flex items-center gap-2 px-6 py-3 rounded-xl
                   bg-gradient-to-r from-blue-500 to-cyan-500
                   text-white font-semibold shadow-lg shadow-blue-500/25
                   hover:shadow-blue-500/40 transition-all"
      >
        <Plus className="w-5 h-5" />
        Create Task
      </motion.button>
    </motion.div>
  );
}

export default function ProjectsHub() {
  // Theme detection
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark');
    }
    return true;
  });

  // Listen for theme changes
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark');
      setIsDark(dark);
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

  // View state
  const [view, setView] = useState<ProjectViewMode>('table');
  
  // Filters state
  const [filters, setFilters] = useState<ProjectFilters>({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all'
  });

  // Sort state
  const [sort, setSort] = useState<ProjectSort>({
    field: 'due_date',
    direction: 'asc'
  });

  // Group expansion state (company id -> collapsed state)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Task form state
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCompanyId, setPreselectedCompanyId] = useState<string | undefined>(undefined);

  // Fetch all tasks (no specific filter to get all user's tasks)
  const { tasks, isLoading, error, fetchTasks, deleteTask, completeTask, uncompleteTask, updateTask } = useTasks();
  const { userData } = useUser();

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.contact_name?.toLowerCase().includes(searchLower) ||
        task.company?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(task => task.status === filters.status);
    }

    // Apply priority filter
    if (filters.priority !== 'all') {
      result = result.filter(task => task.priority === filters.priority);
    }

    // Apply assignee filter
    if (filters.assignee !== 'all') {
      result = result.filter(task => task.assigned_to === filters.assignee);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'due_date':
          const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          comparison = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tasks, filters, sort]);

  // Group tasks by company
  const taskGroups = useMemo((): CompanyTaskGroupType[] => {
    const grouped = new Map<string, { company: Company | null; tasks: Task[] }>();

    filteredTasks.forEach(task => {
      const companyId = task.company_id || 'unassigned';
      
      if (!grouped.has(companyId)) {
        grouped.set(companyId, {
          company: task.companies || null,
          tasks: []
        });
      }
      grouped.get(companyId)!.tasks.push(task);
    });

    // Convert to array and add visual properties
    return Array.from(grouped.entries()).map(([id, data], index): CompanyTaskGroupType => ({
      id,
      company: data.company,
      name: data.company?.name || 'Unassigned Tasks',
      tasks: data.tasks,
      color: data.company ? `from-${getAccentColor(index)}-500` : 'from-gray-500',
      accentColor: data.company ? getAccentColor(index) : 'gray',
      collapsed: collapsedGroups[id] || false
    }));
  }, [filteredTasks, collapsedGroups]);

  // Handlers
  const handleToggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }, []);

  const handleCreateTask = useCallback((companyId?: string) => {
    setEditingTask(undefined);
    setPreselectedCompanyId(companyId);
    setIsTaskFormOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setPreselectedCompanyId(undefined);
    setIsTaskFormOpen(true);
  }, []);

  const handleCloseTaskForm = useCallback(() => {
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
    setPreselectedCompanyId(undefined);
    fetchTasks();
  }, [fetchTasks]);

  const handleCompleteTask = useCallback(async (task: Task) => {
    if (task.completed) {
      await uncompleteTask(task.id);
    } else {
      await completeTask(task.id);
    }
  }, [completeTask, uncompleteTask]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
  }, [deleteTask]);

  const handleUpdateTaskStatus = useCallback(async (taskId: string, status: Task['status']) => {
    await updateTask(taskId, { status });
  }, [updateTask]);

  // Render content based on state
  const renderContent = () => {
    if (isLoading) {
      return <ProjectsSkeleton isDark={isDark} />;
    }

    if (error) {
      return (
        <div className={`p-6 rounded-2xl border ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
          <p>Failed to load tasks. Please try again.</p>
        </div>
      );
    }

    if (filteredTasks.length === 0) {
      return <EmptyState isDark={isDark} onCreateTask={() => handleCreateTask()} />;
    }

    if (view === 'kanban') {
      return (
        <ProjectsKanbanView
          groups={taskGroups}
          isDark={isDark}
          onEditTask={handleEditTask}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={handleDeleteTask}
          onUpdateStatus={handleUpdateTaskStatus}
          onCreateTask={handleCreateTask}
        />
      );
    }

    return (
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {taskGroups.map((group) => (
            <CompanyTaskGroup
              key={group.id}
              group={group}
              isDark={isDark}
              onToggle={() => handleToggleGroup(group.id)}
              onEditTask={handleEditTask}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
              onCreateTask={() => handleCreateTask(group.id !== 'unassigned' ? group.id : undefined)}
            />
          ))}
        </AnimatePresence>

        {/* Add new group prompt */}
        <motion.button
          whileHover={{ scale: 1.01, x: 4 }}
          onClick={() => handleCreateTask()}
          className={`flex items-center gap-3 px-6 py-4 w-full max-w-md
                     rounded-2xl transition-all group
                     ${isDark
                       ? 'text-gray-500 hover:text-white border-2 border-dashed border-gray-800 hover:border-gray-700'
                       : 'text-gray-600 hover:text-gray-900 border-2 border-dashed border-gray-300 hover:border-gray-400'}`}
        >
          <div className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800/50 group-hover:bg-blue-500/20' : 'bg-gray-200/50 group-hover:bg-blue-500/10'}`}>
            <Plus className={`w-5 h-5 group-hover:text-blue-400 ${isDark ? '' : 'text-gray-500'}`} />
          </div>
          <span className="font-medium">Add new task</span>
        </motion.button>
      </div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] 
                            bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[128px]" />
          </>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Projects
          </h1>
          <p className={`mt-1 text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Tasks organized by company
          </p>
        </div>

        {/* Toolbar */}
        <ProjectsToolbar
          view={view}
          onViewChange={setView}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          onCreateTask={() => handleCreateTask()}
          isDark={isDark}
          taskCount={filteredTasks.length}
        />

        {/* Content */}
        <div className="mt-6">
          {renderContent()}
        </div>
      </div>

      {/* Task Form Modal */}
      <TaskForm
        task={editingTask}
        isOpen={isTaskFormOpen}
        onClose={handleCloseTaskForm}
        companyId={preselectedCompanyId}
      />
    </div>
  );
}

