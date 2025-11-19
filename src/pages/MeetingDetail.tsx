import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/clientV2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink, Loader2, AlertCircle, Play, FileText, MessageSquare, Sparkles, ListTodo, Trash2, CheckCircle2, Plus, X } from 'lucide-react';
import FathomPlayerV2, { FathomPlayerV2Handle } from '@/components/FathomPlayerV2';
import { AskAIChat } from '@/components/meetings/AskAIChat';
import { MeetingContent } from '@/components/meetings/MeetingContent';
import { NextActionSuggestions } from '@/components/meetings/NextActionSuggestions';
import { CreateTaskModal } from '@/components/meetings/CreateTaskModal';
import { useActivitiesActions } from '@/lib/hooks/useActivitiesActions';
import { useNextActionSuggestions } from '@/lib/hooks/useNextActionSuggestions';
import { useTasks } from '@/lib/hooks/useTasks';
import { useEventEmitter } from '@/lib/communication/EventBus';
import { toast } from 'sonner';
import { ProposalWizard } from '@/components/proposals/ProposalWizard';

interface Meeting {
  id: string;
  fathom_recording_id: string;
  title: string;
  meeting_start: string;
  meeting_end: string;
  duration_minutes: number;
  share_url: string;
  calls_url: string;
  transcript_doc_url: string | null;
  transcript_text: string | null;
  summary: string | null;
  sentiment_score: number | null;
  sentiment_reasoning: string | null;
  talk_time_rep_pct: number | null;
  talk_time_customer_pct: number | null;
  talk_time_judgement: string | null;
  owner_email: string | null;
  fathom_embed_url?: string | null;
  thumbnail_url?: string | null;
}

interface MeetingAttendee {
  id: string;
  name: string;
  email: string | null;
  is_external: boolean;
  role: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  priority: string;
  category: string | null;
  completed: boolean;
  timestamp_seconds: number | null;
  playback_url: string | null;
  ai_generated: boolean | null;
  ai_confidence: number | null;
  task_id: string | null;
  synced_to_task: boolean | null;
  sync_status: string | null;
  deadline_at: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
}

// Helper functions
function labelSentiment(score: number | null): string {
  if (score == null) return '—';
  if (score <= -0.25) return 'Challenging';
  if (score < 0.25) return 'Neutral';
  return 'Positive';
}

function getSentimentColor(score: number | null): string {
  if (score == null) return 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200';
  if (score > 0.25) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300';
  if (score < -0.25) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300';
  return 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200';
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Enhanced markdown parser for Fathom summaries with beautiful styling
function parseMarkdownSummary(markdown: string): string {
  return markdown
    // Main headers (# Header) - Large, prominent
    .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-white/10">$1</h1>')
    // Section headers (## Header) - Medium, spaced
    .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">$1</h2>')
    // Sub-headers (### Header) - Smaller, colored accent
    .replace(/^### (.*?)$/gm, '<h3 class="text-base font-semibold text-blue-600 dark:text-blue-400 mt-4 mb-2">$1</h3>')
    // Bold text - White and prominent
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
    // Timestamp links - Styled as clickable badges with play icon and consistent spacing
    .replace(/\[(.*?)\]\((https:\/\/fathom\.video\/share\/[^)]+timestamp=([0-9.]+)[^)]*)\)/g,
      '<span class="timestamp-link inline-block align-top px-2 py-1 mb-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer transition-all text-xs font-medium max-w-[90%]" data-timestamp="$3" data-href="$2">' +
      '<svg class="w-3 h-3 inline-block mr-1.5 -mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>' +
      '$1' +
      '</span>')
    // Regular links - Subtle blue
    .replace(/\[(.*?)\]\((https:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">$1</a>')
    // Bullet points - Hidden bullet, consistent spacing with line-height fix
    .replace(/^ - (.*?)$/gm, '<div class="mb-1 text-gray-700 dark:text-gray-300 leading-relaxed min-h-[28px] flex items-start">$1</div>')
    // Numbered lists - Hidden numbers, consistent spacing with line-height fix
    .replace(/^ (\d+)\. (.*?)$/gm, '<div class="mb-1 text-gray-700 dark:text-gray-300 leading-relaxed min-h-[28px] flex items-start">$2</div>')
    // Paragraph breaks - Better spacing
    .replace(/\n\n/g, '<div class="mb-4"></div>')
    // Single line breaks - Smaller spacing
    .replace(/\n/g, '<br/>');
}

export function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<FathomPlayerV2Handle>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { addActivity } = useActivitiesActions();
  const emit = useEventEmitter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [thumbnailEnsured, setThumbnailEnsured] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);

  const primaryExternal = attendees.find(a => a.is_external);

  // AI Suggestions hook
  const {
    suggestions,
    loading: suggestionsLoading,
    refetch: refetchSuggestions,
    pendingCount
  } = useNextActionSuggestions(id || '', 'meeting');

  // Unified Tasks hook - fetches all tasks for this meeting
  const {
    tasks,
    isLoading: tasksLoading,
    fetchTasks: refetchTasks,
    completeTask,
    uncompleteTask
  } = useTasks({ meeting_id: id }, { autoFetch: true });

  // State for action item operations
  const [addingToTasksId, setAddingToTasksId] = useState<string | null>(null);
  const [removingFromTasksId, setRemovingFromTasksId] = useState<string | null>(null);

  // Animation state management
  const [animatingActionItemId, setAnimatingActionItemId] = useState<string | null>(null);
  const [newlyAddedTaskId, setNewlyAddedTaskId] = useState<string | null>(null);
  const [showProposalWizard, setShowProposalWizard] = useState(false);

  // Clear newly added task highlight after animation completes
  useEffect(() => {
    if (newlyAddedTaskId) {
      const timer = setTimeout(() => {
        setNewlyAddedTaskId(null);
      }, 1500); // Clear after 1.5s (animation + pulse complete)
      return () => clearTimeout(timer);
    }
  }, [newlyAddedTaskId]);

  const handleQuickAdd = async (type: 'meeting' | 'outbound' | 'proposal' | 'sale') => {
    if (!meeting) return;
    const clientName = primaryExternal?.name || attendees[0]?.name || meeting.title || 'Prospect';
    // Derive website from primary external attendee email domain when available
    let websiteFromEmail: string | undefined;
    const email = primaryExternal?.email || undefined;
    if (email && email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase();
      const freeDomains = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','proton.me','aol.com'];
      if (domain && !freeDomains.includes(domain)) {
        websiteFromEmail = domain.startsWith('www.') ? domain : `www.${domain}`;
      }
    }

    // Open Quick Add modal with prefilled data
    await emit('modal:opened', {
      type: 'quick-add',
      context: {
        preselectAction: type,
        formId: 'quick-add',
        initialData: {
          client_name: clientName,
          details: `From Fathom: ${meeting.title || 'Meeting'}`,
          date: meeting.meeting_start,
          meeting_id: meeting.id,
          company_id: (meeting as any).company_id || null,
          contact_id: (meeting as any).primary_contact_id || null,
          company_website: websiteFromEmail
        }
      }
    });
  };

  useEffect(() => {
    if (!id) return;

    const fetchMeetingDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch meeting
        const { data: meetingData, error: meetingError } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (meetingError) throw meetingError;
        setMeeting(meetingData);

        // Fetch attendees - combine internal (meeting_attendees) and external (meeting_contacts via contacts)
        const { data: internalAttendeesData, error: internalError } = await supabase
          .from('meeting_attendees')
          .select('*')
          .eq('meeting_id', id);

        if (internalError) throw internalError;

        // Fetch external contacts via meeting_contacts junction
        const { data: externalContactsData, error: externalError } = await supabase
          .from('meeting_contacts')
          .select(`
            contact_id,
            is_primary,
            role,
            contacts (
              id,
              first_name,
              last_name,
              full_name,
              email
            )
          `)
          .eq('meeting_id', id);

        if (externalError) throw externalError;

        // Combine both internal and external attendees
        const combinedAttendees: MeetingAttendee[] = [
          ...(internalAttendeesData || []).map(a => ({
            id: a.id,
            name: a.name,
            email: a.email,
            is_external: false,
            role: a.role
          })),
          ...(externalContactsData || [])
            .filter(mc => mc.contacts) // Filter out null contacts
            .map(mc => {
              const c = mc.contacts as any;
              return {
                id: c.id,
                name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
                email: c.email,
                is_external: true,
                role: mc.is_primary ? 'Primary Contact' : (mc.role || 'attendee')
              };
            })
        ];

        setAttendees(combinedAttendees);

        // Fetch action items
        const { data: actionItemsData, error: actionItemsError } = await supabase
          .from('meeting_action_items')
          .select('*')
          .eq('meeting_id', id)
          .order('timestamp_seconds', { ascending: true });

        if (actionItemsError) throw actionItemsError;
        setActionItems(actionItemsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingDetails();
  }, [id]);

  // Ensure thumbnail exists for this meeting
  useEffect(() => {
    const ensureThumbnail = async () => {
      if (!meeting || thumbnailEnsured) return;
      if (meeting.thumbnail_url) {
        setThumbnailEnsured(true);
        return;
      }

      try {
        // Build embed URL from share_url or recording id
        let embedUrl: string | null = null;
        if (meeting.share_url) {
          try {
            const u = new URL(meeting.share_url);
            const token = u.pathname.split('/').filter(Boolean).pop();
            if (token) embedUrl = `https://fathom.video/embed/${token}`;
          } catch {
            // ignore
          }
        }
        if (!embedUrl && meeting.fathom_recording_id) {
          embedUrl = `https://app.fathom.video/recording/${meeting.fathom_recording_id}`;
        }

        let thumbnailUrl: string | null = null;

        if (embedUrl) {
          // Try generation service first
          const { data, error } = await supabase.functions.invoke('generate-video-thumbnail-v2', {
            body: {
              recording_id: meeting.fathom_recording_id,
              share_url: meeting.share_url,
              fathom_embed_url: embedUrl,
            },
          });

          if (!error && data?.success && data.thumbnail_url) {
            thumbnailUrl = data.thumbnail_url as string;
          }
        }

        // Fallback: placeholder
        if (!thumbnailUrl) {
          const firstLetter = (meeting.title || 'M')[0].toUpperCase();
          thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`;
        }

        // Update meeting record (best effort; RLS must allow owner updates)
        await supabase
          .from('meetings')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', meeting.id);

        // Update local state
        setMeeting({ ...meeting, thumbnail_url: thumbnailUrl });
      } catch (e) {
        // ignore errors; UI will continue without a thumbnail
      } finally {
        setThumbnailEnsured(true);
      }
    };

    ensureThumbnail();
  }, [meeting, thumbnailEnsured]);

  // Handle timestamp jumps in video player
  const handleTimestampJump = useCallback((seconds: number) => {
    setCurrentTimestamp(seconds);

    if (playerRef.current) {
      playerRef.current.seekToTimestamp(seconds);
    }
  }, []);

  // Toggle an action item's completion (bidirectional sync via DB triggers)
  const toggleActionItem = useCallback(async (id: string, completed: boolean) => {
    try {
      // Optimistic update
      setActionItems(prev => prev.map(ai => ai.id === id ? { ...ai, completed: !completed } : ai));

      const { error } = await supabase
        .from('meeting_action_items')
        .update({ completed: !completed, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        // Revert on error
        setActionItems(prev => prev.map(ai => ai.id === id ? { ...ai, completed } : ai));
        throw error;
      }
    } catch (e) {
    }
  }, []);

  // Handle action item extraction - defined before early returns to satisfy Rules of Hooks
  const handleGetActionItems = useCallback(async () => {
    if (!meeting) return;
    setIsExtracting(true);
    try {
      let data: any | null = null;
      try {
        const res = await supabase.functions.invoke('extract-action-items', {
          body: { meetingId: meeting.id }
        });
        if (res.error) throw res.error;
        data = res.data;
      } catch (err: any) {
        const isTransportErr = err?.name === 'FunctionsFetchError' || (typeof err?.message === 'string' && err.message.includes('Failed to send a request'));
        if (!isTransportErr) throw err;

        // Fallback: call the Edge Function directly
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
        const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
        const functionsUrlEnv = (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
        const projectRef = supabaseUrl?.split('//')[1]?.split('.')[0];
        const subdomainBase = projectRef ? `https://${projectRef}.functions.supabase.co` : undefined;
        const defaultBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined;
        const candidates = [functionsUrlEnv, subdomainBase, defaultBase].filter(Boolean) as string[];

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        let lastError: any = err;
        for (const base of candidates) {
          try {
            const resp = await fetch(`${base}/extract-action-items`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                ...(anonKey ? { 'apikey': anonKey } : {}),
                'X-Client-Info': 'sales-dashboard-v2',
              },
              body: JSON.stringify({ meetingId: meeting.id })
            });
            if (!resp.ok) {
              lastError = new Error(`HTTP ${resp.status}`);
              continue;
            }
            data = await resp.json();
            break;
          } catch (e) {
            lastError = e;
            continue;
          }
        }
        if (!data) throw lastError;
      }

      // Refresh action items list
      const { data: actionItemsData } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meeting.id)
        .order('timestamp_seconds', { ascending: true });
      setActionItems(actionItemsData || []);

      // Show empty state message if none created
      const created = Number((data as any)?.itemsCreated || 0);
      if (created === 0) {
        toast.info('No Action Items From Meeting');
      } else {
        toast.success(`Added ${created} action item${created === 1 ? '' : 's'}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to extract action items');
    } finally {
      setIsExtracting(false);
    }
  }, [meeting]);

  // Create task from action item
  const handleCreateTask = useCallback(async (actionItemId: string) => {
    try {
      setCreatingTaskId(actionItemId);

      const { data, error } = await supabase.functions.invoke('create-task-from-action-item', {
        body: { action_item_id: actionItemId }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create task');
      }

      // Update the action item in state
      setActionItems(prev => prev.map(item =>
        item.id === actionItemId
          ? { ...item, task_id: data.task.id, synced_to_task: true, sync_status: 'synced' }
          : item
      ));

      toast.success('Task created successfully');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setCreatingTaskId(null);
    }
  }, []);

  // Delete action item
  const handleDeleteActionItem = useCallback(async (actionItemId: string) => {
    try {
      setDeletingItemId(actionItemId);

      const { error } = await supabase
        .from('meeting_action_items')
        .delete()
        .eq('id', actionItemId);

      if (error) throw error;

      // Remove from state
      setActionItems(prev => prev.filter(item => item.id !== actionItemId));

      toast.success('Action item deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete action item');
    } finally {
      setDeletingItemId(null);
    }
  }, []);


  // Helper function to map action item priority to valid task priority
  const mapPriorityToTaskPriority = (priority: string | null): 'low' | 'medium' | 'high' | 'urgent' => {
    if (!priority) return 'medium';

    const prio = priority.toLowerCase().trim();

    // Direct matches
    if (['low', 'medium', 'high', 'urgent'].includes(prio)) {
      return prio as any;
    }

    // Fuzzy matches
    if (prio.includes('urgent') || prio.includes('critical') || prio.includes('asap')) return 'urgent';
    if (prio.includes('high') || prio.includes('important')) return 'high';
    if (prio.includes('low') || prio.includes('minor')) return 'low';

    // Default fallback
    return 'medium';
  };

  // Helper function to map action item category to valid task_type
  const mapCategoryToTaskType = (category: string | null): 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general' => {
    if (!category) return 'general';

    const cat = category.toLowerCase().trim();

    // Direct matches
    if (['call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general'].includes(cat)) {
      return cat as any;
    }

    // Fuzzy matches
    if (cat.includes('call') || cat.includes('phone')) return 'call';
    if (cat.includes('email') || cat.includes('message')) return 'email';
    if (cat.includes('meeting') || cat.includes('meet')) return 'meeting';
    if (cat.includes('follow') || cat.includes('followup')) return 'follow_up';
    if (cat.includes('proposal') || cat.includes('quote')) return 'proposal';
    if (cat.includes('demo') || cat.includes('presentation')) return 'demo';

    // Default fallback
    return 'general';
  };

  // Handler to add action item to tasks
  const handleAddToTasks = useCallback(async (actionItem: ActionItem) => {
    if (!meeting?.id) return;

    try {
      // Step 1: Start exit animation
      setAddingToTasksId(actionItem.id);
      setAnimatingActionItemId(actionItem.id);

      // Step 2: Wait for exit animation to complete (300ms)
      await new Promise(resolve => setTimeout(resolve, 300));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Authentication required');
        setAnimatingActionItemId(null);
        return;
      }

      // Create task from action item
      // Note: Tasks table requires at least one of: company_id, contact_id, contact_email, or deal_id
      const taskData: any = {
        title: actionItem.title,
        description: `Action item from meeting: ${meeting.title}`,
        due_date: actionItem.deadline_at || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        priority: mapPriorityToTaskPriority(actionItem.priority),
        status: actionItem.completed ? 'completed' : 'pending',
        task_type: mapCategoryToTaskType(actionItem.category),
        assigned_to: user.id,
        created_by: user.id,
        meeting_id: meeting.id,  // CRITICAL: Link task to meeting for filtering
        meeting_action_item_id: actionItem.id,
        notes: actionItem.playback_url ? `Video playback: ${actionItem.playback_url}` : null,
        completed: actionItem.completed
      };

      // Add CRM relationships if available
      if (meeting.company_id) taskData.company_id = meeting.company_id;
      if (meeting.primary_contact_id) taskData.contact_id = meeting.primary_contact_id;

      // If no CRM relationships, use assignee email as fallback to satisfy constraint
      if (!meeting.company_id && !meeting.primary_contact_id) {
        taskData.contact_email = actionItem.assignee_email || user.email;
      }

      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (taskError) {
        throw taskError;
      }

      // Update action item with task link
      const { error: updateError } = await supabase
        .from('meeting_action_items')
        .update({
          task_id: newTask.id,
          synced_to_task: true,
          sync_status: 'synced',
          synced_at: new Date().toISOString()
        })
        .eq('id', actionItem.id);

      if (updateError) throw updateError;

      // Step 3: Update action items state
      setActionItems(prev => prev.map(item =>
        item.id === actionItem.id
          ? { ...item, task_id: newTask.id, synced_to_task: true, sync_status: 'synced' }
          : item
      ));

      // Step 4: Refresh tasks and set newly added task for entrance animation
      await refetchTasks();
      setNewlyAddedTaskId(newTask.id);

      toast.success('Action item added to tasks');
    } catch (e) {
      const errorMessage = e instanceof Error
        ? e.message
        : (typeof e === 'object' && e !== null && 'message' in e)
          ? String((e as any).message)
          : 'Failed to add to tasks';
      toast.error(errorMessage);
      // Clear animation state on error
      setAnimatingActionItemId(null);
    } finally {
      setAddingToTasksId(null);
      // Clear animating state after a small delay to allow error handling
      setTimeout(() => setAnimatingActionItemId(null), 100);
    }
  }, [meeting, refetchTasks, tasks.length]);

  // Handler to remove action item from tasks
  const handleRemoveFromTasks = useCallback(async (actionItem: ActionItem) => {
    if (!actionItem.task_id) return;

    try {
      setRemovingFromTasksId(actionItem.id);

      // Delete the task
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', actionItem.task_id);

      if (deleteError) throw deleteError;

      // Update action item to remove task link
      const { error: updateError } = await supabase
        .from('meeting_action_items')
        .update({
          task_id: null,
          synced_to_task: false,
          sync_status: null,
          synced_at: null
        })
        .eq('id', actionItem.id);

      if (updateError) throw updateError;

      // Refresh both action items and tasks
      setActionItems(prev => prev.map(item =>
        item.id === actionItem.id
          ? { ...item, task_id: null, synced_to_task: false, sync_status: null }
          : item
      ));
      refetchTasks();

      toast.success('Task removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove task');
    } finally {
      setRemovingFromTasksId(null);
    }
  }, [refetchTasks]);

  // Attach click handlers to Fathom timestamp links in summary
  useEffect(() => {
    if (!summaryRef.current || !meeting?.summary) {
      return;
    }

    const handleSummaryLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if clicked element or its parent has data-timestamp attribute
      const timestampEl = target.closest('[data-timestamp]') as HTMLElement;
      if (timestampEl) {
        const timestamp = timestampEl.getAttribute('data-timestamp');
        if (timestamp) {
          e.preventDefault();
          e.stopPropagation();
          const seconds = parseFloat(timestamp);
          handleTimestampJump(seconds);
        }
      }
      // Fallback for old anchor tag format (if any remain)
      else if (target.tagName === 'A' && (target as HTMLAnchorElement).href?.includes('fathom.video')) {
        const url = new URL((target as HTMLAnchorElement).href);
        const timestamp = url.searchParams.get('timestamp');
        if (timestamp) {
          e.preventDefault();
          e.stopPropagation();
          const seconds = parseFloat(timestamp);
          handleTimestampJump(seconds);
        }
      }
    };

    const summaryEl = summaryRef.current;
    summaryEl.addEventListener('click', handleSummaryLinkClick);

    return () => {
      summaryEl.removeEventListener('click', handleSummaryLinkClick);
    };
  }, [meeting?.summary, handleTimestampJump]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Meeting not found'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/meetings')} className="mt-4" variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 min-w-0">
        <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/meetings')} variant="ghost" size="sm" className="min-h-[40px]">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{meeting.title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground break-words">
            {new Date(meeting.meeting_start).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} • {Math.round(meeting.duration_minutes)} min
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:flex-shrink-0">
          {meeting.sentiment_score !== null && (
            <Badge className={getSentimentColor(meeting.sentiment_score)}>
              {labelSentiment(meeting.sentiment_score)}
            </Badge>
          )}
          <Button size="sm" onClick={handleGetActionItems} disabled={isExtracting} className="min-h-[40px] whitespace-nowrap">
            {isExtracting ? 'Getting...' : 'Get Action Items'}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowProposalWizard(true)}
            className="min-h-[40px] whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Proposal
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
        {/* Left Column - Video & Content */}
        <div className="lg:col-span-8 space-y-3 sm:space-y-4 min-w-0">
          {/* Video Player */}
          {(meeting.fathom_recording_id || meeting.share_url) && (
            <div className="glassmorphism-card overflow-hidden">
              <FathomPlayerV2
                ref={playerRef}
                shareUrl={meeting.share_url}
                title={meeting.title}
                startSeconds={currentTimestamp}
                timeoutMs={10000}
                className="aspect-video"
                onLoad={() => undefined}
                onError={() => undefined}
              />
            </div>
          )}

          {/* AI Insights Section */}
          <div className="space-y-4">
            {/* Sentiment Analysis Card */}
            {meeting.sentiment_score !== null && meeting.sentiment_reasoning && (
              <div className="section-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Sentiment Analysis</div>
                  <Badge className={getSentimentColor(meeting.sentiment_score)}>
                    {labelSentiment(meeting.sentiment_score)} ({(meeting.sentiment_score * 100).toFixed(0)}%)
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {meeting.sentiment_reasoning}
                </p>
              </div>
            )}

            {/* Talk Time Analysis Card */}
            {meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
              <div className="section-card">
                <div className="font-semibold mb-3">Talk Time Analysis</div>

                {/* Visual Bar Chart */}
                <div className="mb-3 flex h-8 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
                  <div
                    className="bg-blue-600 flex items-center justify-center text-xs font-medium text-white"
                    style={{ width: `${meeting.talk_time_rep_pct}%` }}
                  >
                    {meeting.talk_time_rep_pct > 15 && `${meeting.talk_time_rep_pct.toFixed(0)}%`}
                  </div>
                  <div
                    className="bg-emerald-600 flex items-center justify-center text-xs font-medium text-white"
                    style={{ width: `${meeting.talk_time_customer_pct}%` }}
                  >
                    {meeting.talk_time_customer_pct > 15 && `${meeting.talk_time_customer_pct.toFixed(0)}%`}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-xs mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-600"></div>
                    <span className="text-muted-foreground">Rep: {meeting.talk_time_rep_pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-600"></div>
                    <span className="text-muted-foreground">Customer: {meeting.talk_time_customer_pct.toFixed(1)}%</span>
                  </div>
                </div>

                {/* AI Judgement */}
                {meeting.talk_time_judgement && (
                  <div className="glassmorphism-light p-3 rounded-lg">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">AI Assessment</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {meeting.talk_time_judgement}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tabbed Interface: Summary, Transcript, Ask AI, Content */}
            <div className="section-card">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="ask-ai">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Ask AI
                  </TabsTrigger>
                  <TabsTrigger value="content">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Content
                  </TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="mt-0">
                  {/* Quick Actions */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleQuickAdd('meeting')}>Add Meeting</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleQuickAdd('outbound')}>Add Outbound</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleQuickAdd('proposal')}>Add Proposal</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleQuickAdd('sale')}>Add Sale</Button>
                  </div>

                  {meeting.summary ? (
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {(() => {
                        try {
                          // Try to parse as JSON first (Fathom format)
                          const parsed = JSON.parse(meeting.summary);
                          if (parsed.markdown_formatted) {
                            // Parse and render markdown content
                            const html = parseMarkdownSummary(parsed.markdown_formatted);
                            return <div ref={summaryRef} dangerouslySetInnerHTML={{ __html: html }} />;
                          }
                          return <div ref={summaryRef} className="whitespace-pre-line">{meeting.summary}</div>;
                        } catch {
                          // If not JSON, just display as plain text
                          return <div ref={summaryRef} className="whitespace-pre-line">{meeting.summary}</div>;
                        }
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Summary will be available after Fathom processes the recording (5-10 minutes after meeting ends).
                    </p>
                  )}

                  <div className="mt-3 flex gap-2 flex-wrap">
                    {meeting.transcript_doc_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={meeting.transcript_doc_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3 w-3 mr-2" />
                          Open transcript
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                    {meeting.share_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={meeting.share_url} target="_blank" rel="noopener noreferrer">
                          Open in Fathom
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Transcript Tab */}
                <TabsContent value="transcript" className="mt-0">
                  {meeting.transcript_text ? (
                    <div className="glassmorphism-light p-4 rounded-lg max-h-[600px] overflow-y-auto">
                      <div className="text-sm leading-relaxed space-y-3">
                        {meeting.transcript_text.split('\n').map((line, idx) => {
                          // Check if line starts with a speaker name (pattern: "Name: text")
                          const speakerMatch = line.match(/^([^:]+):\s*(.*)$/);
                          if (speakerMatch) {
                            const [, speaker, text] = speakerMatch;
                            return (
                              <div key={idx} className="flex gap-3">
                                <div className="font-semibold text-blue-400 min-w-[120px] shrink-0">{speaker}:</div>
                                <div className="text-muted-foreground flex-1">{text}</div>
                              </div>
                            );
                          }
                          // Plain text line (no speaker)
                          return line.trim() ? (
                            <div key={idx} className="text-muted-foreground">{line}</div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Transcript will be available after Fathom processes the recording.
                    </p>
                  )}
                </TabsContent>

                {/* Ask AI Tab */}
                <TabsContent value="ask-ai" className="mt-0">
                  <AskAIChat meetingId={meeting.id} />
                </TabsContent>

                {/* Content Tab */}
                <TabsContent value="content" className="mt-0">
                  <MeetingContent meeting={meeting} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        {/* End of Left Column */}

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4 min-w-0">
          {/* Unified Tasks Section - Static container, only task cards animate */}
          <div className="section-card min-w-0">
            <div className="flex items-center justify-between mb-4 min-w-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate">
                  Tasks ({tasks.length})
                </h3>
              </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => setCreateTaskModalOpen(true)}
                      variant="default"
                      size="sm"
                      className="flex items-center gap-2 min-h-[40px] whitespace-nowrap"
                    >
                      <ListTodo className="w-4 h-4" />
                      <span className="hidden sm:inline">Add Task</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </div>
                </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : tasks.length > 0 ? (
                tasks.map((task) => {
                  const isNewlyAdded = task.id === newlyAddedTaskId;
                  return (
                    <motion.div
                      key={task.id}
                      className="glassmorphism-light p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      initial={isNewlyAdded ? { opacity: 0, x: 100, scale: 0.9 } : false}
                      animate={isNewlyAdded ? {
                        opacity: 1,
                        x: 0,
                        scale: 1,
                        boxShadow: [
                          '0 0 0 0 rgba(34, 197, 94, 0)',
                          '0 0 0 4px rgba(34, 197, 94, 0.3)',
                          '0 0 0 0 rgba(34, 197, 94, 0)'
                        ]
                      } : {}}
                      transition={isNewlyAdded ? {
                        duration: 0.4,
                        ease: 'easeOut',
                        boxShadow: { duration: 1, times: [0, 0.5, 1] }
                      } : {}}
                    >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={task.status === 'completed'}
                          onChange={async () => {
                            try {
                              if (task.status === 'completed') {
                                await uncompleteTask(task.id);
                                toast.success('Task marked as incomplete');
                              } else {
                                await completeTask(task.id);
                                toast.success('Task marked as complete');
                              }
                              await refetchTasks();
                            } catch (error) {
                              const errorMessage = error instanceof Error
                                ? error.message
                                : (typeof error === 'object' && error !== null && 'message' in error)
                                  ? String((error as any).message)
                                  : 'Failed to update task';
                              toast.error(errorMessage);
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 bg-white text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-500"
                          aria-label="Mark task complete"
                        />
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          task.priority === 'urgent' || task.priority === 'high'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {task.priority}
                      </Badge>
                      {task.status === 'completed' && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 text-xs">
                          ✓ Complete
                        </Badge>
                      )}
                      {task.task_type && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {task.task_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    {/* Timestamp playback if available */}
                    {task.metadata?.timestamp_seconds && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTimestampJump(task.metadata.timestamp_seconds)}
                          className="text-xs"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {formatTimestamp(task.metadata.timestamp_seconds)}
                        </Button>
                      </div>
                    )}
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">
                    No tasks yet for this meeting
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Convert action items to tasks using the "Add to Tasks" button below
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Items Section */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                Action Items ({actionItems.length})
              </h3>
            </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto">
              {actionItems.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {actionItems
                    .filter(item => item.id !== animatingActionItemId)
                    .map((item) => (
                      <motion.div
                        key={item.id}
                        className="glassmorphism-light p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: 0.8,
                          y: 20,
                          transition: { duration: 0.3, ease: 'easeIn' }
                        }}
                        layout
                      >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleActionItem(item.id, item.completed)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 bg-white text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-500"
                          aria-label="Mark action item complete"
                        />
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.title}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge
                        variant={
                          item.priority === 'urgent' || item.priority === 'high'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {item.priority}
                      </Badge>
                      {item.completed && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 text-xs">
                          ✓ Complete
                        </Badge>
                      )}
                      {item.ai_generated && (
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-xs">
                          🤖 AI
                        </Badge>
                      )}
                      {item.category && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {item.category.replace('_', ' ')}
                        </span>
                      )}
                      {item.synced_to_task && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-xs">
                          ✓ In Tasks
                        </Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {!item.synced_to_task ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddToTasks(item)}
                          disabled={addingToTasksId === item.id}
                          className="text-xs"
                        >
                          {addingToTasksId === item.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <ListTodo className="h-3 w-3 mr-1" />
                              Add to Tasks
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveFromTasks(item)}
                          disabled={removingFromTasksId === item.id}
                          className="text-xs"
                        >
                          {removingFromTasksId === item.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Removing...
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Remove from Tasks
                            </>
                          )}
                        </Button>
                      )}

                      {/* Timestamp playback if available */}
                      {item.timestamp_seconds && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTimestampJump(item.timestamp_seconds!)}
                          className="text-xs"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {formatTimestamp(item.timestamp_seconds)}
                        </Button>
                      )}
                    </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">
                    No action items yet for this meeting
                  </p>
                  <Button
                    onClick={handleGetActionItems}
                    variant="outline"
                    size="sm"
                    disabled={!meeting?.transcript_text}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract Action Items
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Attendees */}
          <div className="section-card">
            <div className="font-semibold mb-2">Attendees</div>
            <div className="space-y-2">
              {attendees.length > 0 ? (
                attendees.map((attendee) => {
                  const isExternal = attendee.is_external;
                  const contactId = isExternal ? attendee.id : null;
                  const content = (
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{attendee.name}</div>
                        {attendee.email && (
                          <div className="text-muted-foreground text-xs">{attendee.email}</div>
                        )}
                      </div>
                      {isExternal ? (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                          External
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Internal
                        </Badge>
                      )}
                    </div>
                  );

                  return contactId ? (
                    <Link
                      key={attendee.id}
                      to={`/crm/contacts/${contactId}`}
                      className="block hover:bg-gray-100 dark:hover:bg-zinc-900/40 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={attendee.id}
                      className="block hover:bg-gray-100 dark:hover:bg-zinc-900/40 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      {content}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No attendees recorded</p>
              )}
            </div>
          </div>

          {/* Meeting Info */}
          <div className="section-card">
            <div className="font-semibold mb-2">Meeting Info</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{Math.round(meeting.duration_minutes)} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Host:</span>
                <span className="truncate ml-2">{meeting.owner_email || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start:</span>
                <span>{new Date(meeting.meeting_start).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End:</span>
                <span>{new Date(meeting.meeting_end).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="section-card">
            <div className="font-semibold mb-2">Debug Info</div>
            <div className="text-xs font-mono text-muted-foreground space-y-1 break-all">
              <div>
                <span className="text-muted-foreground/70">Recording ID:</span>
                <br />
                {meeting.fathom_recording_id}
              </div>
              <div>
                <span className="text-muted-foreground/70">Share URL:</span>
                <br />
                {meeting.share_url}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {meeting && (
        <CreateTaskModal
          meetingId={meeting.id}
          meetingTitle={meeting.title}
          open={createTaskModalOpen}
          onOpenChange={setCreateTaskModalOpen}
          onTaskCreated={refetchTasks}
        />
      )}
      {meeting && (
        <ProposalWizard
          open={showProposalWizard}
          onOpenChange={setShowProposalWizard}
          meetingIds={[meeting.id]}
          contactName={meeting.contact?.email || undefined}
          companyName={meeting.company?.name}
        />
      )}
    </div>
  );
}
