import React, { useState } from 'react';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { Task } from '@/lib/database/models';

interface SubtaskExampleProps {
  parentTaskId: string;
}

export const SubtaskExample: React.FC<SubtaskExampleProps> = ({ parentTaskId }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [selectedSubtasks, setSelectedSubtasks] = useState<string[]>([]);

  const {
    subtasks,
    subtaskStats,
    isLoading,
    error,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    completeSubtask,
    uncompleteSubtask,
    bulkUpdateSubtasks,
    fetchSubtasks
  } = useSubtasks({ parentTaskId });

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      await createSubtask({
        title: newSubtaskTitle,
        assigned_to: 'current-user-id', // Should come from user context
        priority: 'medium',
        task_type: 'general'
      });
      setNewSubtaskTitle('');
    } catch (error) {
    }
  };

  const handleToggleComplete = async (subtask: Task) => {
    try {
      if (subtask.completed) {
        await uncompleteSubtask(subtask.id);
      } else {
        await completeSubtask(subtask.id);
      }
    } catch (error) {
    }
  };

  const handleDelete = async (subtaskId: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) return;

    try {
      await deleteSubtask(subtaskId);
    } catch (error) {
    }
  };

  const handleBulkComplete = async () => {
    if (selectedSubtasks.length === 0) return;

    try {
      await bulkUpdateSubtasks(selectedSubtasks, {
        completed: true,
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      setSelectedSubtasks([]);
    } catch (error) {
    }
  };

  const handleSelectSubtask = (subtaskId: string) => {
    setSelectedSubtasks(prev => 
      prev.includes(subtaskId) 
        ? prev.filter(id => id !== subtaskId)
        : [...prev, subtaskId]
    );
  };

  if (isLoading) {
    return <div className="p-4">Loading subtasks...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-700">Error loading subtasks: {error.message}</p>
        <button 
          onClick={() => fetchSubtasks()}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Subtasks</h2>
      
      {/* Statistics */}
      {subtaskStats && (
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="font-medium">Total:</span> {subtaskStats.total}
            </div>
            <div>
              <span className="font-medium">Completed:</span> {subtaskStats.completed}
            </div>
            <div>
              <span className="font-medium">In Progress:</span> {subtaskStats.in_progress}
            </div>
            <div>
              <span className="font-medium">Progress:</span> {subtaskStats.completion_percentage}%
            </div>
            <div>
              <span className="font-medium">Overdue:</span> 
              <span className={subtaskStats.overdue > 0 ? 'text-red-600 ml-1' : 'ml-1'}>
                {subtaskStats.overdue}
              </span>
            </div>
            <div>
              <span className="font-medium">Due Today:</span> 
              <span className={subtaskStats.due_today > 0 ? 'text-orange-600 ml-1' : 'ml-1'}>
                {subtaskStats.due_today}
              </span>
            </div>
            <div>
              <span className="font-medium">High Priority:</span> 
              <span className={subtaskStats.high_priority > 0 ? 'text-purple-600 ml-1' : 'ml-1'}>
                {subtaskStats.high_priority}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Create new subtask */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add new subtask..."
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreateSubtask()}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreateSubtask}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add
        </button>
      </div>

      {/* Bulk actions */}
      {selectedSubtasks.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
          <span className="text-sm text-blue-700">
            {selectedSubtasks.length} selected
          </span>
          <button
            onClick={handleBulkComplete}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Mark Complete
          </button>
          <button
            onClick={() => setSelectedSubtasks([])}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-2">
        {subtasks.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No subtasks yet. Add one above to get started.
          </p>
        ) : (
          subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={`flex items-center gap-3 p-3 border rounded ${
                subtask.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSubtasks.includes(subtask.id)}
                onChange={() => handleSelectSubtask(subtask.id)}
                className="rounded"
              />
              
              <button
                onClick={() => handleToggleComplete(subtask)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  subtask.completed
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {subtask.completed && '✓'}
              </button>

              <div className="flex-1">
                <h4 className={`font-medium ${subtask.completed ? 'line-through text-gray-500' : ''}`}>
                  {subtask.title}
                </h4>
                <div className="text-sm text-gray-500 space-x-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    subtask.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    subtask.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    subtask.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {subtask.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    subtask.status === 'completed' ? 'bg-green-100 text-green-800' :
                    subtask.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    subtask.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {subtask.status.replace('_', ' ')}
                  </span>
                  {subtask.due_date && (
                    <span>Due: {new Date(subtask.due_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(subtask.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};