import React, { useState, useEffect } from 'react';
import { LayoutGrid, List, RefreshCw, CheckCircle, AlertCircle, Settings, Video, Filter } from 'lucide-react';
import TaskList from '@/components/TaskList';
import TaskForm from '@/components/TaskForm';
import TaskKanban from '@/components/TaskKanban';
import GoogleTasksSync from '@/components/GoogleTasksSync';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/database/models';
import { googleTasksSync } from '@/lib/services/googleTasksSync';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [showMeetingTasksOnly, setShowMeetingTasksOnly] = useState(false);

  useEffect(() => {
    checkGoogleConnection();

    // Check if there's a task_id in the URL query params
    const taskId = searchParams.get('task_id');
    if (taskId) {
      openTaskById(taskId);
    }
  }, [searchParams]);

  const checkGoogleConnection = async () => {
    try {
      const connected = await googleTasksSync.isConnected();
      setIsGoogleConnected(connected);
    } catch (error) {
    }
  };

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
      toast.error('Failed to open task');
      // Remove the task_id param from URL
      searchParams.delete('task_id');
      setSearchParams(searchParams);
    }
  };

  const handleSync = async () => {
    if (!isGoogleConnected) {
      toast.error('Please connect Google Tasks first');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      const result = await googleTasksSync.performSync(await getCurrentUserId());
      
      if (result.success) {
        setSyncStatus('success');
        toast.success(`Sync complete! ${result.tasksCreated} created, ${result.tasksUpdated} updated`);
        
        if (result.conflicts.length > 0) {
          toast.warning(`${result.conflicts.length} conflicts need resolution`);
        }
        
        // Refresh the task list
        window.location.reload();
      } else {
        setSyncStatus('error');
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      setSyncStatus('error');
      toast.error('Failed to sync with Google Tasks');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const getCurrentUserId = async (): Promise<string> => {
    const { supabase } = await import('@/lib/supabase/clientV2');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
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
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 min-h-screen">
      {/* Google Tasks Sync Component */}
      <GoogleTasksSync />

      {/* Header with View Toggle and Sync Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Tasks</h1>
          <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mt-1 flex flex-wrap items-center gap-2">
            {isGoogleConnected
              ? 'Synced with Google Tasks'
              : 'Manage your tasks and stay organized'}
            {showMeetingTasksOnly && (
              <Badge variant="secondary" className="text-xs">
                <Video className="w-3 h-3 mr-1" />
                Meeting Tasks Only
              </Badge>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Meeting Tasks Filter Toggle */}
          <Button
            variant={showMeetingTasksOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMeetingTasksOnly(!showMeetingTasksOnly)}
            className="flex items-center gap-2 min-h-[40px] h-10 px-3"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">{showMeetingTasksOnly ? 'Show All Tasks' : 'Meeting Tasks'}</span>
            <span className="sm:hidden">{showMeetingTasksOnly ? 'All' : 'Meetings'}</span>
          </Button>
          {/* Sync Button */}
          {isGoogleConnected && (
            <>
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                variant="outline"
                className={`
                  min-h-[40px] h-10 px-3
                  ${syncStatus === 'success'
                    ? 'border-emerald-500 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                    : syncStatus === 'error'
                    ? 'border-red-500 dark:border-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : ''
                  }
                  transition-all duration-300
                `}
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </>
                ) : syncStatus === 'success' ? (
                  <>
                    <CheckCircle className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Synced</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sync Failed</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sync with Google</span>
                  </>
                )}
              </Button>
              <Button
                onClick={() => navigate('/tasks/settings')}
                variant="outline"
                size="icon"
                title="Google Tasks Settings"
                className="min-h-[40px] min-w-[40px] h-10 w-10"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className="min-h-[36px] h-9 px-3"
            >
              <List className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
              className="min-h-[36px] h-9 px-3"
            >
              <LayoutGrid className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Kanban</span>
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