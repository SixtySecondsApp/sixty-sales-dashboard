/**
 * Email to Task Conversion Button
 * Allows users to quickly convert an email into a task
 */

import { useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { GmailMessage } from '@/lib/types/gmail';
import TaskForm from '../TaskForm';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface EmailToTaskButtonProps {
  email: GmailMessage;
  className?: string;
}

export function EmailToTaskButton({ email, className = '' }: EmailToTaskButtonProps) {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  // Extract contact info from email sender
  const extractContactInfo = () => {
    const fromAddress = email.from;

    // Handle EmailAddress object
    const contactEmail = fromAddress?.email || '';
    const contactName = fromAddress?.name || contactEmail.split('@')[0] || '';

    return { contactName, contactEmail };
  };

  const handleCreateTask = () => {
    logger.log('📧 Converting email to task:', {
      subject: email.subject,
      from: email.from,
      id: email.id
    });

    toast.success('Opening task form...');
    setIsTaskFormOpen(true);
  };

  const { contactName, contactEmail } = extractContactInfo();

  // Pre-fill task data from email
  const initialTaskData = {
    // Use email subject as task title
    title: email.subject || 'Follow up on email',

    // Use email body as description
    description: `Follow up on email from ${contactName}:\n\n${email.body_text || 'No content'}`,

    // Contact information
    contactName,
    contactEmail,

    // Default to email type task
    task_type: 'email' as const,

    // Default to tomorrow
    // due_date handled by TaskForm
  };

  return (
    <>
      <button
        onClick={handleCreateTask}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors ${className}`}
        title="Create Task from Email"
      >
        <CheckSquare className="w-4 h-4" />
        <span>Create Task</span>
      </button>

      {/* Task Form Modal */}
      {isTaskFormOpen && (
        <TaskForm
          isOpen={isTaskFormOpen}
          onClose={() => setIsTaskFormOpen(false)}
          contactName={initialTaskData.contactName}
          contactEmail={initialTaskData.contactEmail}
          onTaskCreated={(task) => {
            toast.success('Task created from email!');
            logger.log('✅ Task created from email:', task);
            setIsTaskFormOpen(false);
          }}
        />
      )}
    </>
  );
}
