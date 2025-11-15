import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Loader2, Slack, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface SlackIntegration {
  id: string;
  workspace_name: string | null;
  webhook_url: string;
  notifications_enabled: boolean;
  notification_types: {
    meeting_tasks?: boolean;
    deadlines?: boolean;
    overdue?: boolean;
  };
}

export function SlackIntegrationSettings() {
  const [config, setConfig] = useState<SlackIntegration | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [notifyMeetingTasks, setNotifyMeetingTasks] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [testing, setTesting] = useState(false);

  // Load existing configuration on mount
  useEffect(() => {
    loadSlackConfig();
  }, []);

  const loadSlackConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('slack_integrations')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found, which is okay
        toast.error('Failed to load Slack configuration');
        return;
      }

      if (data) {
        setConfig(data);
        setWebhookUrl(data.webhook_url || '');
        setWorkspaceName(data.workspace_name || '');
        setEnabled(data.notifications_enabled);
        setNotifyMeetingTasks(data.notification_types?.meeting_tasks ?? true);
        setNotifyDeadlines(data.notification_types?.deadlines ?? true);
        setNotifyOverdue(data.notification_types?.overdue ?? true);
      }
    } catch (error: any) {
    } finally {
      setInitialLoad(false);
    }
  };

  const validateWebhookUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'hooks.slack.com' && urlObj.pathname.startsWith('/services/');
    } catch {
      return false;
    }
  };

  const saveSlackConfig = async () => {
    // Validate webhook URL
    if (!validateWebhookUrl(webhookUrl)) {
      toast.error('Invalid Slack webhook URL', {
        description: 'Please enter a valid Slack incoming webhook URL',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('slack_integrations').upsert(
        {
          webhook_url: webhookUrl,
          workspace_name: workspaceName || null,
          notifications_enabled: enabled,
          notification_types: {
            meeting_tasks: notifyMeetingTasks,
            deadlines: notifyDeadlines,
            overdue: notifyOverdue,
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

      if (error) throw error;

      toast.success('Slack integration saved!', {
        description: 'Your notification preferences have been updated.',
      });

      // Reload config to get the ID and confirm save
      await loadSlackConfig();
    } catch (error: any) {
      toast.error('Failed to save Slack integration', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSlackConfig = async () => {
    if (!config) return;

    if (!confirm('Are you sure you want to remove your Slack integration?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('slack_integrations').delete().eq('id', config.id);

      if (error) throw error;

      toast.success('Slack integration removed');

      // Reset form
      setConfig(null);
      setWebhookUrl('');
      setWorkspaceName('');
      setEnabled(false);
    } catch (error: any) {
      toast.error('Failed to remove Slack integration', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!config || !enabled) {
      toast.error('Please save your Slack integration first');
      return;
    }

    setTesting(true);
    try {
      // Create a test notification
      const { data, error } = await supabase.from('task_notifications').insert({
        notification_type: 'meeting_tasks_available',
        title: '🧪 Test Notification',
        message: 'This is a test notification from your CRM. If you can see this, Slack notifications are working!',
        task_count: 1,
        metadata: {
          source: 'Test',
          test: true,
        },
      }).select().single();

      if (error) throw error;

      toast.success('Test notification sent!', {
        description: 'Check your Slack channel for the test message.',
      });
    } catch (error: any) {
      toast.error('Failed to send test notification', {
        description: error.message,
      });
    } finally {
      setTesting(false);
    }
  };

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Slack className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Slack Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Get notified in Slack when important events happen in your CRM
            </p>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                How to get your Slack Webhook URL:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>
                  Go to{' '}
                  <a
                    href="https://api.slack.com/messaging/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600 dark:hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    Slack Incoming Webhooks
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Create a new webhook for your workspace</li>
                <li>Select the channel where you want notifications</li>
                <li>Copy the webhook URL and paste it below</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4">
          {/* Workspace Name (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Workspace Name (Optional)
            </label>
            <Input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g., Acme Corp Workspace"
              className="w-full"
            />
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Slack Webhook URL <span className="text-red-500">*</span>
            </label>
            <Input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full font-mono text-sm"
            />
            {webhookUrl && !validateWebhookUrl(webhookUrl) && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Please enter a valid Slack webhook URL
              </p>
            )}
          </div>

          {/* Enable Notifications Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Enable Slack Notifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Receive notifications in your Slack channel
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Notification Type Preferences */}
          {enabled && (
            <div className="space-y-3 pl-4 border-l-2 border-purple-200 dark:border-purple-800/50">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Notification Types
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Meeting Task Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    When AI finds tasks in your meetings
                  </p>
                </div>
                <Switch checked={notifyMeetingTasks} onCheckedChange={setNotifyMeetingTasks} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Deadline Reminders</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    When tasks are approaching their due date
                  </p>
                </div>
                <Switch checked={notifyDeadlines} onCheckedChange={setNotifyDeadlines} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Overdue Task Alerts</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    When tasks become overdue
                  </p>
                </div>
                <Switch checked={notifyOverdue} onCheckedChange={setNotifyOverdue} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={saveSlackConfig} disabled={loading || !webhookUrl} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Integration
              </>
            )}
          </Button>

          {config && (
            <>
              <Button
                variant="outline"
                onClick={sendTestNotification}
                disabled={testing || !enabled}
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Test'
                )}
              </Button>

              <Button variant="destructive" onClick={deleteSlackConfig} disabled={loading}>
                Remove
              </Button>
            </>
          )}
        </div>

        {/* Status Indicator */}
        {config && (
          <div className="flex items-center gap-2 text-sm">
            {enabled ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-700 dark:text-green-400">Active</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-gray-600 dark:text-gray-400">Disabled</span>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
