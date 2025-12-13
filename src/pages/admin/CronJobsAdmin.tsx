import React, { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Clock,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  Plus,
  Trash2,
  Settings,
  History,
  Bell,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  display_name?: string;
  description?: string;
  category?: string;
  is_monitored?: boolean;
  alert_on_failure?: boolean;
  last_run?: {
    runid: number;
    status: string;
    start_time: string;
    end_time: string;
    return_message: string;
  };
  failures_last_24h: number;
  runs_last_24h: number;
}

interface JobRun {
  runid: number;
  jobid: number;
  jobname: string;
  status: string;
  start_time: string;
  end_time: string;
  return_message: string;
  duration_seconds: number;
}

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  is_active: boolean;
  notify_on_failure: boolean;
  notify_on_success: boolean;
  created_at: string;
}

export default function CronJobsAdmin() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [history, setHistory] = useState<JobRun[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [newSubscriberEmail, setNewSubscriberEmail] = useState('');
  const [newSubscriberName, setNewSubscriberName] = useState('');
  const [addingSubscriber, setAddingSubscriber] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('cron-admin', {
        method: 'GET',
      });

      if (error) throw error;
      setJobs(data?.jobs || []);
    } catch (err) {
      console.error('Failed to fetch cron jobs:', err);
      toast.error('Failed to load cron jobs');
    }
  }, []);

  const fetchHistory = useCallback(async (jobName?: string) => {
    try {
      const params = new URLSearchParams();
      if (jobName) params.set('job_name', jobName);
      params.set('limit', '50');

      const { data, error } = await supabase.functions.invoke(`cron-admin/history?${params}`, {
        method: 'GET',
      });

      if (error) throw error;
      setHistory(data?.history || []);
    } catch (err) {
      console.error('Failed to fetch job history:', err);
      toast.error('Failed to load job history');
    }
  }, []);

  const fetchSubscribers = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('cron-admin/subscribers', {
        method: 'GET',
      });

      if (error) throw error;
      setSubscribers(data?.subscribers || []);
    } catch (err) {
      console.error('Failed to fetch subscribers:', err);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchHistory(), fetchSubscribers()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchJobs, fetchHistory, fetchSubscribers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchJobs(), fetchHistory(selectedJob || undefined), fetchSubscribers()]);
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const handleToggleJob = async (jobname: string, active: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('cron-admin/toggle', {
        method: 'POST',
        body: { jobname, active },
      });

      if (error) throw error;
      toast.success(`Job ${active ? 'enabled' : 'disabled'}`);
      await fetchJobs();
    } catch (err) {
      console.error('Failed to toggle job:', err);
      toast.error('Failed to update job');
    }
  };

  const handleRunJob = async (jobname: string) => {
    try {
      toast.info(`Running ${jobname}...`);

      const { data, error } = await supabase.functions.invoke('cron-admin/run', {
        method: 'POST',
        body: { jobname },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Job ${jobname} completed successfully`);
      } else {
        toast.error(`Job failed: ${data?.result?.error || 'Unknown error'}`);
      }

      await fetchJobs();
      await fetchHistory(selectedJob || undefined);
    } catch (err) {
      console.error('Failed to run job:', err);
      toast.error('Failed to run job');
    }
  };

  const handleAddSubscriber = async () => {
    if (!newSubscriberEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setAddingSubscriber(true);
    try {
      const { error } = await supabase.functions.invoke('cron-admin/subscribers', {
        method: 'POST',
        body: {
          email: newSubscriberEmail.trim(),
          name: newSubscriberName.trim() || null,
          is_active: true,
          notify_on_failure: true,
        },
      });

      if (error) throw error;
      toast.success('Subscriber added');
      setNewSubscriberEmail('');
      setNewSubscriberName('');
      await fetchSubscribers();
    } catch (err) {
      console.error('Failed to add subscriber:', err);
      toast.error('Failed to add subscriber');
    } finally {
      setAddingSubscriber(false);
    }
  };

  const handleRemoveSubscriber = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke(`cron-admin/subscribers?id=${id}`, {
        method: 'DELETE',
      });

      if (error) throw error;
      toast.success('Subscriber removed');
      await fetchSubscribers();
    } catch (err) {
      console.error('Failed to remove subscriber:', err);
      toast.error('Failed to remove subscriber');
    }
  };

  const toggleJobExpanded = (jobname: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobname)) {
        next.delete(jobname);
      } else {
        next.add(jobname);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30">
            {status}
          </Badge>
        );
    }
  };

  const parseSchedule = (schedule: string): string => {
    // Convert cron expression to human readable
    const parts = schedule.split(' ');
    if (parts.length < 5) return schedule;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (minute.startsWith('*/') && hour === '*') {
      return `Every ${minute.slice(2)} minutes`;
    }
    if (minute === '0' && hour === '*') {
      return 'Every hour';
    }
    if (minute === '0' && hour !== '*') {
      return `Daily at ${hour}:00`;
    }

    return schedule;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cron Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage scheduled background tasks
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {jobs.filter((j) => j.active).length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failures (24h)</p>
                <p className="text-2xl font-bold text-red-500">
                  {jobs.reduce((sum, j) => sum + (j.failures_last_24h || 0), 0)}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Subscribers</p>
                <p className="text-2xl font-bold">{subscribers.length}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">
            <Clock className="h-4 w-4 mr-2" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Run History
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No cron jobs found
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.jobid} className={cn(!job.active && 'opacity-60')}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleJobExpanded(job.jobname)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        {expandedJobs.has(job.jobname) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div>
                        <CardTitle className="text-base">
                          {job.display_name || job.jobname}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">
                          {job.jobname}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {job.last_run && getStatusBadge(job.last_run.status)}

                      <Badge variant="outline" className="font-mono text-xs">
                        {parseSchedule(job.schedule)}
                      </Badge>

                      <Switch
                        checked={job.active}
                        onCheckedChange={(checked) => handleToggleJob(job.jobname, checked)}
                      />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRunJob(job.jobname)}
                        disabled={!job.active}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Run Now
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedJobs.has(job.jobname) && (
                  <CardContent className="pt-0">
                    <div className="pl-8 space-y-3">
                      {job.description && (
                        <p className="text-sm text-muted-foreground">{job.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Category</p>
                          <p className="font-medium capitalize">{job.category || 'General'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Runs (24h)</p>
                          <p className="font-medium">{job.runs_last_24h || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Failures (24h)</p>
                          <p
                            className={cn(
                              'font-medium',
                              (job.failures_last_24h || 0) > 0 && 'text-red-500'
                            )}
                          >
                            {job.failures_last_24h || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Run</p>
                          <p className="font-medium">
                            {job.last_run?.start_time
                              ? formatDistanceToNow(new Date(job.last_run.start_time), {
                                  addSuffix: true,
                                })
                              : 'Never'}
                          </p>
                        </div>
                      </div>

                      {job.last_run?.return_message && (
                        <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                          <p className="text-xs font-mono text-muted-foreground">
                            {job.last_run.return_message}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <select
              value={selectedJob || ''}
              onChange={(e) => {
                setSelectedJob(e.target.value || null);
                fetchHistory(e.target.value || undefined);
              }}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Jobs</option>
              {jobs.map((job) => (
                <option key={job.jobid} value={job.jobname}>
                  {job.display_name || job.jobname}
                </option>
              ))}
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Job</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Started</th>
                      <th className="px-4 py-3 text-left font-medium">Duration</th>
                      <th className="px-4 py-3 text-left font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No run history found
                        </td>
                      </tr>
                    ) : (
                      history.map((run) => (
                        <tr key={run.runid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 font-mono text-xs">{run.jobname}</td>
                          <td className="px-4 py-3">{getStatusBadge(run.status)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {run.start_time
                              ? format(new Date(run.start_time), 'MMM d, HH:mm:ss')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {run.duration_seconds !== null
                              ? `${run.duration_seconds.toFixed(2)}s`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate">
                            {run.return_message || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Subscribers</CardTitle>
              <CardDescription>
                These email addresses will receive alerts when cron jobs fail
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Subscriber Form */}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={newSubscriberEmail}
                  onChange={(e) => setNewSubscriberEmail(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="text"
                  placeholder="Name (optional)"
                  value={newSubscriberName}
                  onChange={(e) => setNewSubscriberName(e.target.value)}
                  className="w-48"
                />
                <Button onClick={handleAddSubscriber} disabled={addingSubscriber}>
                  {addingSubscriber ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>

              {/* Subscribers List */}
              <div className="space-y-2">
                {subscribers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No subscribers yet. Add an email to receive failure alerts.
                  </p>
                ) : (
                  subscribers.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{sub.email}</p>
                          {sub.name && (
                            <p className="text-xs text-muted-foreground">{sub.name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={sub.is_active ? 'default' : 'secondary'}
                            className={cn(
                              sub.is_active
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                : ''
                            )}
                          >
                            {sub.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {sub.notify_on_failure && (
                            <Badge variant="outline" className="text-xs">
                              Failures
                            </Badge>
                          )}
                          {sub.notify_on_success && (
                            <Badge variant="outline" className="text-xs">
                              Success
                            </Badge>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveSubscriber(sub.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
