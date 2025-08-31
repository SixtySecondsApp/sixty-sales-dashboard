import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Send, RefreshCw, CheckCircle2, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTasks } from '@/lib/hooks/useTasks';
import TaskForm from '@/components/TaskForm';
import type { Contact, Task } from '@/lib/database/models';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface ContactMainContentProps {
  contact: Contact;
  activeTab: string;
}

export function ContactMainContent({ contact, activeTab }: ContactMainContentProps) {
  // Use the real useTasks hook with contact filtering
  const { 
    tasks, 
    isLoading: loading, 
    completeTask, 
    uncompleteTask, 
    deleteTask: removeTask,
    fetchTasks,
    createTask
  } = useTasks({ contact_id: contact.id, completed: false });

  // Task form state
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'border-l-red-500 bg-red-500/5';
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'low': return 'border-l-green-500 bg-green-500/5';
      default: return 'border-l-gray-500 bg-gray-500/5';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>;
      case 'low': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Low</Badge>;
      default: return <Badge variant="outline">Normal</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Handle task completion toggle
  const handleTaskComplete = async (task: Task) => {
    try {
      if (task.completed) {
        await uncompleteTask(task.id);
        toast.success('Task marked as incomplete');
      } else {
        await completeTask(task.id);
        toast.success('Task completed!');
      }
    } catch (error) {
      logger.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  // Handle task deletion
  const handleTaskDelete = async (task: Task) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await removeTask(task.id);
        toast.success('Task deleted');
      } catch (error) {
        logger.error('Error deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  // Handle creating new task
  const handleCreateTask = () => {
    setEditingTask(undefined);
    setIsTaskFormOpen(true);
  };

  // Handle editing existing task
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  // Handle task creation callback from TaskForm
  const handleTaskCreated = async (newTask: Task) => {
    logger.log('Task created, refreshing list:', newTask);
    // Force immediate refresh to show the new task
    await fetchTasks();
  };

  // Handle closing task form with immediate refresh
  const handleCloseTaskForm = async () => {
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
    
    // Add a small delay then force refresh to ensure we see the new task
    setTimeout(async () => {
      await fetchTasks();
    }, 200);
  };

  // Create a wrapper for task creation that ensures it shows up immediately
  const handleTaskCreation = async (taskData: any) => {
    try {
      const newTask = await createTask({
        ...taskData,
        contact_id: contact.id, // Ensure contact_id is set
      });
      
      // Task should automatically appear due to useTasks hook updating
      logger.log('Task created for contact:', newTask);
      return newTask;
    } catch (error) {
      logger.error('Error creating task:', error);
      throw error;
    }
  };

  if (activeTab === 'overview') {
    return (
      <div className="lg:col-span-2 space-y-6">
        {/* Tasks Section */}
        <div className="section-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              Active Tasks
              {tasks.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-gray-700 text-gray-200 border-gray-600 font-mono text-xs">
                  {tasks.length}
                </Badge>
              )}
            </h2>
            <button 
              className="btn-primary"
              onClick={handleCreateTask}
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          </div>

          {tasks && tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className={`p-4 rounded-lg border-l-4 bg-gray-800/50 ${getPriorityColor(task.priority)} transition-all hover:bg-gray-800/70`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={task.completed || false}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                        onChange={() => handleTaskComplete(task)}
                      />
                      <div>
                        <h3 className={`text-white font-medium ${task.completed ? 'line-through opacity-60' : ''}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className={`text-gray-400 text-sm ${task.completed ? 'opacity-60' : ''}`}>
                            {task.description}
                          </p>
                        )}
                        {task.task_type && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs">
                              {task.task_type.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    {getPriorityBadge(task.priority)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {task.due_date ? formatDate(task.due_date) : 'No due date'}</span>
                      {task.assignee && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span>Assigned to: {task.assignee.first_name} {task.assignee.last_name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        className="btn-icon hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                        onClick={() => handleEditTask(task)}
                        title="Edit task"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        className="btn-icon hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        onClick={() => handleTaskDelete(task)}
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No active tasks</p>
              <p className="text-sm">Create a new task to get started with managing your contact activities.</p>
            </div>
          )}
        </div>

        {/* AI Email Composer */}
        <div className="section-card bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              AI Email Follow-up
            </h2>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              Based on contact data
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <h3 className="text-white font-medium mb-2">Suggested Email</h3>
              <div className="text-sm text-gray-300 space-y-2">
                <p><strong>Subject:</strong> Following up on our recent conversation</p>
                <p><strong>Hi {contact.first_name || 'there'},</strong></p>
                <p>Hope you're doing well! I wanted to follow up on our recent discussions about {
                  tasks.length > 0 ? 'the opportunities we discussed' : 'potential collaboration'
                }.</p>
                {contact.company && (
                  <p>I believe our solutions could be a great fit for {contact.company.name}'s needs.</p>
                )}
                <p>Would you have time for a brief call this week to discuss next steps?</p>
                <p><strong>Best regards,<br />Your Sales Team</strong></p>
              </div>
            </div>

            <div className="btn-group">
              <button className="btn-primary flex-1">
                <Send className="w-4 h-4" />
                <span>Send Email</span>
              </button>
              <button className="btn-outline">
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
              <button className="btn-outline">
                <RefreshCw className="w-4 h-4" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Task Form Modal */}
        <TaskForm
          task={editingTask}
          isOpen={isTaskFormOpen}
          onClose={handleCloseTaskForm}
          contactId={contact.id}
          contactName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email}
          contactEmail={contact.email}
          company={contact.company?.name || ''}
          onTaskCreated={handleTaskCreated}
        />
      </div>
    );
  }

  // For other tabs, show placeholder content
  return (
    <div className="lg:col-span-2 space-y-6">
      {activeTab === 'tasks' ? (
        <TasksTabContent 
          contact={contact} 
          onCreateTask={handleCreateTask}
          onEditTask={handleEditTask}
        />
      ) : (
        <div className="section-card">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Content
            </h3>
            <p className="text-gray-500 text-sm">
              This section will display {activeTab}-related information for {contact.first_name || contact.email}.
            </p>
          </div>
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        task={editingTask}
        isOpen={isTaskFormOpen}
        onClose={handleCloseTaskForm}
        contactId={contact.id}
        contactName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email}
        contactEmail={contact.email}
        company={contact.company?.name || ''}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}

// Tasks Tab Content Component
function TasksTabContent({ 
  contact, 
  onCreateTask, 
  onEditTask 
}: { 
  contact: Contact; 
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
}) {
  const { 
    tasks, 
    isLoading: loading, 
    completeTask, 
    uncompleteTask, 
    deleteTask: removeTask 
  } = useTasks({ contact_id: contact.id }); // Get all tasks (completed and incomplete)

  const [showCompleted, setShowCompleted] = useState(false);

  const filteredTasks = showCompleted ? tasks : tasks.filter(task => !task.completed);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'border-l-red-500 bg-red-500/5';
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'low': return 'border-l-green-500 bg-green-500/5';
      default: return 'border-l-gray-500 bg-gray-500/5';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>;
      case 'low': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Low</Badge>;
      default: return <Badge variant="outline">Normal</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const handleTaskComplete = async (task: Task) => {
    try {
      if (task.completed) {
        await uncompleteTask(task.id);
        toast.success('Task marked as incomplete');
      } else {
        await completeTask(task.id);
        toast.success('Task completed!');
      }
    } catch (error) {
      logger.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleTaskDelete = async (task: Task) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await removeTask(task.id);
        toast.success('Task deleted');
      } catch (error) {
        logger.error('Error deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  return (
    <div className="section-card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-blue-400" />
          Tasks for {contact.first_name || contact.email}
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            Show completed
          </label>
          <button 
            className="btn-primary"
            onClick={onCreateTask}
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div key={task.id} className={`p-4 rounded-lg border-l-4 bg-gray-800/50 ${getPriorityColor(task.priority)} transition-all hover:bg-gray-800/70`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={task.completed || false}
                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                      onChange={() => handleTaskComplete(task)}
                    />
                    <div>
                      <h3 className={`text-white font-medium ${task.completed ? 'line-through opacity-60' : ''}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className={`text-gray-400 text-sm mt-1 ${task.completed ? 'opacity-60' : ''}`}>
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {task.task_type && (
                          <Badge variant="outline" className="text-xs">
                            {task.task_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                        {task.status && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              task.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              task.status === 'overdue' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}
                          >
                            {task.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {getPriorityBadge(task.priority)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-400 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {task.due_date ? formatDate(task.due_date) : 'No due date'}</span>
                    </div>
                    {task.assignee && (
                      <div className="flex items-center gap-1">
                        <span>Assigned to: {task.assignee.first_name} {task.assignee.last_name}</span>
                      </div>
                    )}
                    {task.created_at && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>Created: {formatDate(task.created_at)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="btn-icon hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                      onClick={() => onEditTask(task)}
                      title="Edit task"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      className="btn-icon hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      onClick={() => handleTaskDelete(task)}
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">
                {showCompleted ? 'No tasks found' : 'No active tasks'}
              </p>
              <p className="text-sm">
                {showCompleted 
                  ? 'This contact has no tasks yet.' 
                  : 'All tasks for this contact are completed. Toggle "Show completed" to see them.'
                }
              </p>
            </div>
          )}
        </div>
    </div>
  );
} 