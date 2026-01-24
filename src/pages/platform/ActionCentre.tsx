/**
 * Action Centre Page
 *
 * AC-002: Personal inbox for AI-generated suggestions awaiting HITL approval.
 *
 * Shows:
 * - Pending tab: Items awaiting action (approve/dismiss)
 * - Completed tab: Approved and dismissed items
 * - Recent Activity tab: 7-day conversation memory
 *
 * @see docs/project-requirements/PRD_ACTION_CENTRE.md
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  CheckCircle,
  History,
  Filter,
  Search,
  RefreshCw,
  Bell,
  BellOff,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';

// Components
import { ActionCard } from '@/components/action-centre/ActionCard';
import { RecentActivityList } from '@/components/action-centre/RecentActivityList';

// ============================================================================
// Types
// ============================================================================

export interface ActionCentreItem {
  id: string;
  user_id: string;
  organization_id: string;
  action_type: 'email' | 'task' | 'slack_message' | 'field_update' | 'alert' | 'insight' | 'meeting_prep';
  risk_level: 'low' | 'medium' | 'high' | 'info';
  title: string;
  description: string | null;
  preview_data: Record<string, unknown>;
  contact_id: string | null;
  deal_id: string | null;
  meeting_id: string | null;
  status: 'pending' | 'approved' | 'dismissed' | 'done' | 'expired';
  source_type: 'proactive_pipeline' | 'proactive_meeting' | 'copilot_conversation' | 'sequence';
  source_id: string | null;
  slack_message_ts: string | null;
  slack_channel_id: string | null;
  created_at: string;
  updated_at: string;
  actioned_at: string | null;
  expires_at: string;
}

type TabValue = 'pending' | 'completed' | 'activity';
type ActionTypeFilter = 'all' | ActionCentreItem['action_type'];
type DateFilter = 'all' | 'today' | '7days' | '30days';

/**
 * SS-003: Get date threshold for date filter
 */
function getDateThreshold(filter: DateFilter): Date | null {
  if (filter === 'all') return null;

  const now = new Date();
  switch (filter) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7days':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export default function ActionCentre() {
  const { activeOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = activeOrg?.id;
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<TabValue>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<ActionTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // SS-004: Track realtime subscription
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch pending items
  const { data: pendingItems, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['action-centre-pending', organizationId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_centre_items')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActionCentreItem[];
    },
    enabled: !!organizationId && !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch completed items (approved, dismissed, done)
  const { data: completedItems, isLoading: completedLoading, refetch: refetchCompleted } = useQuery({
    queryKey: ['action-centre-completed', organizationId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_centre_items')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['approved', 'dismissed', 'done'])
        .order('actioned_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ActionCentreItem[];
    },
    enabled: !!organizationId && !!userId && activeTab === 'completed',
  });

  // SS-004: Subscribe to realtime updates for new Action Centre items
  useEffect(() => {
    if (!userId) return;

    // Subscribe to new pending items
    const channel = supabase
      .channel(`action-centre-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'action_centre_items',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newItem = payload.new as ActionCentreItem;
          if (newItem.status === 'pending') {
            // Show toast notification
            toast.info(
              <div className="flex flex-col gap-1">
                <span className="font-medium">New Action Available</span>
                <span className="text-sm text-gray-500">{newItem.title}</span>
              </div>,
              {
                action: {
                  label: 'View',
                  onClick: () => {
                    setActiveTab('pending');
                    refetchPending();
                  },
                },
                duration: 5000,
              }
            );

            // Refetch pending items
            refetchPending();

            // Invalidate nav badge count
            queryClient.invalidateQueries({ queryKey: ['action-centre-pending-count'] });
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [userId, queryClient, refetchPending]);

  // Filter items based on search, type, and date (SS-003)
  const filterItems = (items: ActionCentreItem[] | undefined) => {
    if (!items) return [];

    const dateThreshold = getDateThreshold(dateFilter);

    return items.filter(item => {
      // Type filter
      if (actionTypeFilter !== 'all' && item.action_type !== actionTypeFilter) {
        return false;
      }

      // Date filter (SS-003)
      if (dateThreshold) {
        const itemDate = new Date(item.created_at);
        if (itemDate < dateThreshold) {
          return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          (item.description?.toLowerCase().includes(query) ?? false)
        );
      }

      return true;
    });
  };

  const filteredPending = filterItems(pendingItems);
  const filteredCompleted = filterItems(completedItems);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ itemId, edits }: { itemId: string; edits?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('action_centre_items')
        .update({
          status: 'approved',
          actioned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(edits && { preview_data: edits }),
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-centre-pending'] });
      queryClient.invalidateQueries({ queryKey: ['action-centre-completed'] });
      toast.success('Action approved');
    },
    onError: (error) => {
      toast.error('Failed to approve action');
      console.error('Approve error:', error);
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('action_centre_items')
        .update({
          status: 'dismissed',
          actioned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-centre-pending'] });
      queryClient.invalidateQueries({ queryKey: ['action-centre-completed'] });
      toast.success('Action dismissed');
    },
    onError: (error) => {
      toast.error('Failed to dismiss action');
      console.error('Dismiss error:', error);
    },
  });

  const handleApprove = (itemId: string, edits?: Record<string, unknown>) => {
    approveMutation.mutate({ itemId, edits });
  };

  const handleDismiss = (itemId: string) => {
    dismissMutation.mutate(itemId);
  };

  const handleRefresh = () => {
    if (activeTab === 'pending') {
      refetchPending();
    } else if (activeTab === 'completed') {
      refetchCompleted();
    }
  };

  const pendingCount = pendingItems?.length ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Inbox className="w-7 h-7" />
            Action Centre
            {pendingCount > 0 && (
              <Badge variant="default" className="ml-2 bg-blue-500">
                {pendingCount}
              </Badge>
            )}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review and approve AI-suggested actions
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={actionTypeFilter} onValueChange={(v) => setActionTypeFilter(v as ActionTypeFilter)}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="email">Emails</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="slack_message">Slack</SelectItem>
            <SelectItem value="field_update">Field Updates</SelectItem>
            <SelectItem value="alert">Alerts</SelectItem>
            <SelectItem value="insight">Insights</SelectItem>
            <SelectItem value="meeting_prep">Meeting Prep</SelectItem>
          </SelectContent>
        </Select>

        {/* SS-003: Date filter */}
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-36">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pending" className="gap-2">
            <Inbox className="w-4 h-4" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <History className="w-4 h-4" />
            Recent Activity
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-6">
          {pendingLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredPending.length > 0 ? (
            <motion.div className="space-y-4" layout>
              <AnimatePresence mode="popLayout">
                {filteredPending.map((item) => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    onApprove={handleApprove}
                    onDismiss={handleDismiss}
                    isLoading={approveMutation.isPending || dismissMutation.isPending}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <EmptyState
              icon={<BellOff className="w-12 h-12 text-gray-400" />}
              title="No pending actions"
              description="You're all caught up! New AI suggestions will appear here."
            />
          )}
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value="completed" className="mt-6">
          {completedLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredCompleted.length > 0 ? (
            <div className="space-y-4">
              {filteredCompleted.map((item) => (
                <ActionCard
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onDismiss={handleDismiss}
                  isLoading={false}
                  isCompleted
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle className="w-12 h-12 text-gray-400" />}
              title="No completed actions"
              description="Actions you approve or dismiss will appear here."
            />
          )}
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <RecentActivityList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
