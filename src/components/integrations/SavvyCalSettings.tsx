import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Zap, ExternalLink, ChevronDown, ChevronUp, Calendar, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSavvyCalIntegration } from '@/lib/hooks/useSavvyCalIntegration';

export function SavvyCalSettings() {
  const [showWebhookGuide, setShowWebhookGuide] = useState(true);

  const {
    isConnected,
    hasApiToken,
    webhookUrl,
    webhookVerified,
    webhookLastReceived,
    loading,
    checking,
    checkWebhook,
    canManage,
  } = useSavvyCalIntegration();

  const copyWebhookUrl = async () => {
    if (!webhookUrl) {
      toast.error('Webhook URL not available. Please configure SavvyCal first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  const handleCheckWebhook = async () => {
    try {
      await checkWebhook();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify webhook');
    }
  };

  // Show loading state
  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50 shadow-sm dark:shadow-none dark:backdrop-blur-xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50 shadow-sm dark:shadow-none dark:backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center shadow-sm">
              <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-900 dark:text-gray-100">SavvyCal</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Receive instant notifications when meetings are booked
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : hasApiToken ? (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                Configuring
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500 border-gray-400">
                Not Connected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL Section */}
        <Alert className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
          <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <AlertDescription className="text-purple-800 dark:text-purple-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Enable instant booking sync</span>
                  {webhookVerified && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWebhookGuide(!showWebhookGuide)}
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30"
                >
                  {showWebhookGuide ? (
                    <>Hide Guide <ChevronUp className="w-4 h-4 ml-1" /></>
                  ) : (
                    <>Show Guide <ChevronDown className="w-4 h-4 ml-1" /></>
                  )}
                </Button>
              </div>

              {/* Webhook URL with copy button */}
              {webhookUrl ? (
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900/50 rounded border border-purple-200 dark:border-purple-700">
                  <code className="flex-1 text-xs text-purple-900 dark:text-purple-100 break-all font-mono">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyWebhookUrl}
                    className="shrink-0 text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                  Configure SavvyCal on the{' '}
                  <a href="/integrations" className="text-purple-600 dark:text-purple-400 hover:underline">
                    Integrations page
                  </a>{' '}
                  to get your webhook URL.
                </div>
              )}

              {/* Verify webhook button */}
              {hasApiToken && webhookUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckWebhook}
                  disabled={checking || !canManage}
                  className="w-full border-purple-300 dark:border-purple-700"
                >
                  {checking ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  )}
                  Verify Webhook is Installed
                </Button>
              )}

              {/* Collapsible Guide */}
              {showWebhookGuide && (
                <div className="space-y-3 pt-2 border-t border-purple-200 dark:border-purple-700">
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    Why add this webhook?
                  </p>
                  <ul className="text-sm space-y-1 text-purple-700 dark:text-purple-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                      <span>New bookings appear instantly in your CRM (no waiting for sync)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                      <span>Contacts are automatically created or matched</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                      <span>Track lead sources based on your booking links</span>
                    </li>
                  </ul>

                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100 pt-2">
                    How to set it up:
                  </p>
                  <ol className="text-sm space-y-2 text-purple-700 dark:text-purple-300">
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">1.</span>
                      <span>Copy the webhook URL above</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">2.</span>
                      <span>
                        Go to your{' '}
                        <a
                          href="https://savvycal.com/integrations"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-purple-900 dark:hover:text-purple-100 inline-flex items-center gap-1"
                        >
                          SavvyCal Integrations page
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">3.</span>
                      <span>Click "Add endpoint" and paste the URL</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">4.</span>
                      <span>Select the "event.created" event type</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">5.</span>
                      <span>Save - new bookings will now sync instantly!</span>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {/* Info about link mappings */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>
            Once connected, you can configure lead source mappings for your booking links in{' '}
            <a
              href="/admin/savvycal"
              className="text-purple-600 dark:text-purple-400 hover:underline"
            >
              Admin Settings
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
