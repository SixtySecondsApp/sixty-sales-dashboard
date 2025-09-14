import React, { useState, useEffect } from 'react';
import { LayoutGrid, List, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import TaskList from '@/components/TaskList';
import TaskForm from '@/components/TaskForm';
import TaskKanban from '@/components/TaskKanban';
import GoogleTasksSync from '@/components/GoogleTasksSync';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/database/models';
import { googleTasksSync } from '@/lib/services/googleTasksSync';
import { toast } from 'sonner';

const TasksPage: React.FC = () => {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    checkGoogleConnection();
  }, []);

  const checkGoogleConnection = async () => {
    try {
      const connected = await googleTasksSync.isConnected();
      setIsGoogleConnected(connected);
    } catch (error) {
      console.error('Failed to check Google connection:', error);
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
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6 lg:p-8">
      {/* Google Tasks Sync Component */}
      <GoogleTasksSync />

      {/* Header with View Toggle and Sync Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Tasks</h1>
          <p className="text-gray-400 mt-1">
            {isGoogleConnected 
              ? 'Synced with Google Tasks' 
              : 'Manage your tasks and stay organized'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sync Button */}
          {isGoogleConnected && (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              variant="outline"
              className={`
                ${syncStatus === 'success' 
                  ? 'border-green-500 text-green-500 hover:bg-green-500/10' 
                  : syncStatus === 'error'
                  ? 'border-red-500 text-red-500 hover:bg-red-500/10'
                  : 'border-gray-600 text-gray-300 hover:bg-gray-800'
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
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={`
                ${view === 'list' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }
                transition-all duration-200
              `}
            >
              <List className="w-4 h-4 mr-2" />
              List View
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
              className={`
                ${view === 'kanban' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }
                transition-all duration-200
              `}
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