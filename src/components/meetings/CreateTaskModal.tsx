import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

interface CreateTaskModalProps {
  meetingId: string;
  meetingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
}

export function CreateTaskModal({
  meetingId,
  meetingTitle,
  open,
  onOpenChange,
  onTaskCreated
}: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'follow_up' as 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to create tasks');
        return;
      }

      // Get meeting details for additional context
      const { data: meeting } = await supabase
        .from('meetings')
        .select('company_id, primary_contact_id')
        .eq('id', meetingId)
        .single();

      // Create task
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || `From meeting: ${meetingTitle}`,
          task_type: formData.task_type,
          priority: formData.priority,
          status: 'pending',
          completed: false,
          assigned_to: user.id,
          created_by: user.id,
          meeting_id: meetingId,
          company_id: meeting?.company_id || null,
          contact_id: meeting?.primary_contact_id || null,
          due_date: formData.due_date || null,
          source: 'manual',
          metadata: {
            created_from: 'meeting_detail_page',
            meeting_title: meetingTitle
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Task created successfully!');

      // Reset form
      setFormData({
        title: '',
        description: '',
        task_type: 'follow_up',
        priority: 'medium',
        due_date: ''
      });

      // Close modal and refresh tasks
      onOpenChange(false);
      onTaskCreated();
    } catch (error: any) {
      toast.error('Failed to create task', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task for meeting: {meetingTitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Task Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Follow up with client"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details about this task..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label htmlFor="task_type">Task Type</Label>
            <Select
              value={formData.task_type}
              onValueChange={(value: any) => setFormData({ ...formData, task_type: value })}
              disabled={loading}
            >
              <SelectTrigger id="task_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              disabled={loading}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date (Optional)</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
