import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Pencil, Trash2, Check, X } from 'lucide-react';
import { Task } from '@/lib/database/models';

function formatDue(due?: string) {
  if (!due) return 'No due date';
  const dt = new Date(due);
  if (Number.isNaN(dt.getTime())) return 'Invalid due date';
  return dt.toLocaleString();
}

export function TaskQuickView({
  open,
  onOpenChange,
  task,
  onEdit,
  onToggleComplete,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onEdit?: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task</DialogTitle>
        </DialogHeader>

        {!task ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">No task selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                  {task.title}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {task.task_type?.replace('_', ' ') || 'task'}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {task.status?.replace('_', ' ')}
                  </Badge>
                  {(task as any).meeting_id && (
                    <Badge variant="outline">From meeting</Badge>
                  )}
                  {(task as any).call_id && (
                    <Badge variant="outline">From call</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onToggleComplete && (
                  <Button
                    size="sm"
                    variant={task.completed ? 'outline' : 'default'}
                    onClick={() => onToggleComplete(task)}
                  >
                    {task.completed ? (
                      <>
                        <X className="w-4 h-4 mr-1.5" />
                        Mark incomplete
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        Complete
                      </>
                    )}
                  </Button>
                )}
                {onEdit && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => onDelete(task)}>
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Due</div>
                <div className="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDue(task.due_date)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</div>
                <div className="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}
                </div>
              </div>
            </div>

            {task.description && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {task.description}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}









