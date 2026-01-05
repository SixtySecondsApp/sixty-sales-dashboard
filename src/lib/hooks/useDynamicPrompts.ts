/**
 * Dynamic Prompts Hook
 * Generates contextually relevant CoPilot prompts based on user's actual data
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuthUser } from '@/lib/hooks/useAuthUser';

interface DynamicPrompt {
  text: string;
  category: 'priority' | 'deal' | 'contact' | 'task' | 'meeting';
}

const DEFAULT_PROMPTS: DynamicPrompt[] = [
  { text: 'What should I prioritize today?', category: 'priority' },
  { text: 'Show me deals that need attention', category: 'deal' },
  { text: 'What tasks are overdue?', category: 'task' }
];

export function useDynamicPrompts(maxPrompts: number = 3): {
  prompts: string[];
  isLoading: boolean;
} {
  const [prompts, setPrompts] = useState<string[]>(DEFAULT_PROMPTS.map(p => p.text));
  const [isLoading, setIsLoading] = useState(true);
  const { data: user } = useAuthUser();

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchDynamicPrompts = async () => {
      try {
        const dynamicPrompts: DynamicPrompt[] = [];

        // Fetch data in parallel for performance
        const [contactsResult, dealsResult, tasksResult, meetingsResult] = await Promise.all([
          // Get recent contacts with activity
          supabase
            .from('contacts')
            .select('id, full_name, first_name, last_name, updated_at')
            .eq('owner_id', user.id)  // contacts table uses owner_id, not user_id
            .order('updated_at', { ascending: false })
            .limit(5),

          // Get deals needing attention (low health score or stale)
          supabase
            .from('deals')
            .select('id, name, health_score, updated_at, expected_close_date')
            .eq('user_id', user.id)
            .or('health_score.lt.50,health_score.is.null')
            .order('value', { ascending: false })
            .limit(5),

          // Get overdue or high-priority tasks
          supabase
            .from('tasks')
            .select('id, title, due_date, priority, status')
            .eq('assigned_to', user.id)
            .neq('status', 'completed')
            .order('due_date', { ascending: true })
            .limit(5),

          // Get upcoming meetings (next 7 days)
          supabase
            .from('calendar_events')
            .select('id, title, start_time, attendees')
            .eq('user_id', user.id)
            .gte('start_time', new Date().toISOString())
            .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('start_time', { ascending: true })
            .limit(3)
        ]);

        // Generate contact-based prompts
        if (contactsResult.data && contactsResult.data.length > 0) {
          const recentContact = contactsResult.data[0];
          const contactName = recentContact.full_name ||
            `${recentContact.first_name || ''} ${recentContact.last_name || ''}`.trim() ||
            'this contact';

          dynamicPrompts.push({
            text: `Draft a follow-up email for ${contactName}`,
            category: 'contact'
          });
        }

        // Generate deal-based prompts
        if (dealsResult.data && dealsResult.data.length > 0) {
          const atRiskDeal = dealsResult.data.find(d => d.health_score && d.health_score < 50);
          if (atRiskDeal) {
            dynamicPrompts.push({
              text: `What's blocking the ${atRiskDeal.name} deal?`,
              category: 'deal'
            });
          } else {
            dynamicPrompts.push({
              text: 'Show me deals that need attention',
              category: 'deal'
            });
          }
        }

        // Generate task-based prompts
        if (tasksResult.data && tasksResult.data.length > 0) {
          const overdueTasks = tasksResult.data.filter(t =>
            t.due_date && new Date(t.due_date) < new Date()
          );

          if (overdueTasks.length > 0) {
            dynamicPrompts.push({
              text: `I have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} - what should I tackle first?`,
              category: 'task'
            });
          } else {
            const highPriorityTask = tasksResult.data.find(t => t.priority === 'high');
            if (highPriorityTask) {
              dynamicPrompts.push({
                text: 'Show me my high priority tasks',
                category: 'task'
              });
            }
          }
        }

        // Generate meeting-based prompts
        if (meetingsResult.data && meetingsResult.data.length > 0) {
          const nextMeeting = meetingsResult.data[0];
          const meetingTitle = nextMeeting.title || 'my next meeting';
          dynamicPrompts.push({
            text: `Prep me for ${meetingTitle}`,
            category: 'meeting'
          });
        }

        // Always include the general priority question
        dynamicPrompts.unshift({
          text: 'What should I prioritize today?',
          category: 'priority'
        });

        // Deduplicate and limit
        const uniquePrompts = dynamicPrompts
          .filter((prompt, index, self) =>
            index === self.findIndex(p => p.category === prompt.category)
          )
          .slice(0, maxPrompts);

        // If we don't have enough prompts, fill with defaults
        while (uniquePrompts.length < maxPrompts) {
          const defaultPrompt = DEFAULT_PROMPTS.find(dp =>
            !uniquePrompts.some(up => up.category === dp.category)
          );
          if (defaultPrompt) {
            uniquePrompts.push(defaultPrompt);
          } else {
            break;
          }
        }

        setPrompts(uniquePrompts.slice(0, maxPrompts).map(p => p.text));
      } catch (error) {
        console.error('Error fetching dynamic prompts:', error);
        // Fall back to defaults on error
        setPrompts(DEFAULT_PROMPTS.slice(0, maxPrompts).map(p => p.text));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDynamicPrompts();
  }, [user?.id, maxPrompts]);

  return { prompts, isLoading };
}

export default useDynamicPrompts;
