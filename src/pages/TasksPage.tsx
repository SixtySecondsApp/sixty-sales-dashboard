import React, { useState, useEffect } from 'react';
import { LayoutGrid, List, RefreshCw, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import TaskList from '@/components/TaskList';
import TaskForm from '@/components/TaskForm';
import TaskKanban from '@/components/TaskKanban';
import GoogleTasksSync from '@/components/GoogleTasksSync';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/database/models';
import { googleTasksSync } from '@/lib/services/googleTasksSync';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

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
      console.error('Failed to check Google connection:', error);
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
          meeting_action_item:meeting_action_items(
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
      console.error('Sync error:', error);
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Google Tasks Sync Component */}
      <GoogleTasksSync />

      {/* Header with View Toggle and Sync Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tasks</h1>
          <p className="text-gray-700 dark:text-gray-300 mt-1">
            {isGoogleConnected
              ? 'Synced with Google Tasks'
              : 'Manage your tasks and stay organized'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Sync Button */}
          {isGoogleConnected && (
            <>
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                variant="outline"
                className={`
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
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : syncStatus === 'success' ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Synced
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Sync Failed
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync with Google
                  </>
                )}
              </Button>
              <Button
                onClick={() => navigate('/tasks/settings')}
                variant="outline"
                size="icon"
                title="Google Tasks Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </>
          )}

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
        />
      ) : (
        <TaskKanban 
          onEditTask={handleEditTask}
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