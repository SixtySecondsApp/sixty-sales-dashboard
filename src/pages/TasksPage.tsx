import React, { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import TaskList from '@/components/TaskList';
import TaskForm from '@/components/TaskForm';
import TaskKanban from '@/components/TaskKanban';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/database/models';

const TasksPage: React.FC = () => {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');

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
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Tasks</h1>
          <p className="text-gray-400 mt-1">Manage your tasks and stay organized</p>
        </div>
        
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