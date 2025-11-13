import React, { useState, useEffect } from 'react';
import { LayoutGrid, List, Video } from 'lucide-react';
import TaskList from '@/components/TaskList';
import TaskForm from '@/components/TaskForm';
import TaskKanban from '@/components/TaskKanban';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/database/models';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const TasksPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [showMeetingTasksOnly, setShowMeetingTasksOnly] = useState(false);

  useEffect(() => {
    // Check if there's a task_id in the URL query params
    const taskId = searchParams.get('task_id');
    if (taskId) {
      openTaskById(taskId);
    }
  }, [searchParams]);

  const openTaskById = async (taskId: string) => {
    try {
      const { supabase } = await import('@/lib/supabase/clientV2');

      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          company:companies(id, name, domain),
          contact:contacts(id, full_name, first_name, last_name, email),
          meeting_action_item:meeting_action_items!tasks_meeting_action_item_id_fkey(
            id,
            meeting_id,
            timestamp_seconds,
            playback_url,
            meeting:meetings(id, title, share_url)
          )
        `)
        .eq('id', taskId)
        .single();

      if (error) {
        toast.error('Failed to load task');
        console.error('Error loading task:', error);
        // Remove the task_id param from URL
        searchParams.delete('task_id');
        setSearchParams(searchParams);
        return;
      }

      if (task) {
        setEditingTask(task as Task);
        setIsTaskFormOpen(true);
        // Remove the task_id param from URL after opening
        searchParams.delete('task_id');
        setSearchParams(searchParams);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      toast.error('Failed to open task');
      // Remove the task_id param from URL
      searchParams.delete('task_id');
      setSearchParams(searchParams);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(undefined);
    setIsTaskFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleCloseTaskForm = () => {
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tasks</h1>
          <p className="text-gray-700 dark:text-gray-300 mt-1 flex items-center gap-2">
            Manage your tasks and stay organized
            {showMeetingTasksOnly && (
              <Badge variant="secondary" className="ml-2">
                <Video className="w-3 h-3 mr-1" />
                Meeting Tasks Only
              </Badge>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Meeting Tasks Filter Toggle */}
          <Button
            variant={showMeetingTasksOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMeetingTasksOnly(!showMeetingTasksOnly)}
            className="flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            {showMeetingTasksOnly ? 'Show All Tasks' : 'Meeting Tasks'}
          </Button>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="w-4 h-4 mr-2" />
              List View
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Kanban View
            </Button>
          </div>
        </div>
      </div>

      {/* Content based on view */}
      {view === 'list' ? (
        <TaskList
          showCompleted={false}
          onCreateTask={handleCreateTask}
          onEditTask={handleEditTask}
          meetingTasksOnly={showMeetingTasksOnly}
        />
      ) : (
        <TaskKanban
          onEditTask={handleEditTask}
          meetingTasksOnly={showMeetingTasksOnly}
        />
      )}
      
      <TaskForm
        task={editingTask}
        isOpen={isTaskFormOpen}
        onClose={handleCloseTaskForm}
      />
    </div>
  );
};

export default TasksPage;