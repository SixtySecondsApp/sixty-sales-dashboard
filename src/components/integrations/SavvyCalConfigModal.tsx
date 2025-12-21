import React, { useState } from 'react';
import {
  ConfigureModal,
  ConfigSection,
} from './ConfigureModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Copy,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSavvyCalIntegration } from '@/lib/hooks/useSavvyCalIntegration';
import { ProcessMapButton } from '@/components/process-maps';

interface SavvyCalConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavvyCalConfigModal({ open, onOpenChange }: SavvyCalConfigModalProps) {
  const navigate = useNavigate();
  const [showWebhookGuide, setShowWebhookGuide] = useState(true);
  const [showApiTokenInput, setShowApiTokenInput] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const {
    status,
    isConnected,
    hasApiToken,
    webhookUrl,
    webhookVerified,
    webhookLastReceived,
    lastSyncAt,
    canManage,
    loading,
    checking,
    syncing,
    connectApiToken,
    disconnect,
    checkWebhook,
    triggerSync,
  } = useSavvyCalIntegration();

  const copyWebhookUrl = async () => {
    if (!webhookUrl) {
      toast.error('Webhook URL not available. Please configure your API token first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied to clipboard!');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  const handleSaveApiToken = async () => {
    if (!apiToken.trim()) {
      toast.error('Please enter your SavvyCal API token');
      return;
    }

    setIsSaving(true);
    try {
      await connectApiToken(apiToken.trim(), webhookSecret.trim());
      setApiToken('');
      setWebhookSecret('');
      setShowApiTokenInput(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save API token');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect SavvyCal? This will remove your API token and webhook configuration.')) {
      return;
    }
    try {
      await disconnect();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect');
    }
  };

  const handleCheckWebhook = async () => {
    try {
      await checkWebhook();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify webhook');
    }
  };

  const handleSync = async () => {
    try {
      await triggerSync(24);
    } catch (err: any) {
      toast.error(err?.message || 'Sync failed');
    }
  };

  // SavvyCal icon (purple calendar)
  const SavvyCalIcon = () => (
    <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
  );

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <ConfigureModal
      open={open}
      onOpenChange={onOpenChange}
      integrationId="savvycal"
      integrationName="SavvyCal"
      fallbackIcon={<SavvyCalIcon />}
      showFooter={false}
    >
      {/* Connection Status */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* API Token Section */}
          <ConfigSection title="API Connection">
            {hasApiToken ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Connected
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Last Sync:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(lastSyncAt)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Last Webhook:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(webhookLastReceived)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing || !canManage}
                    className="flex-1"
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={!canManage}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                    Connect your SavvyCal Personal Access Token to enable API features like backfilling events and webhook verification.
                  </AlertDescription>
                </Alert>

                {!showApiTokenInput ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiTokenInput(true)}
                    disabled={!canManage}
                    className="w-full"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Add API Token
                  </Button>
                ) : (
                  <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="space-y-1.5">
                      <Label htmlFor="api-token" className="text-xs">
                        Personal Access Token
                      </Label>
                      <Input
                        id="api-token"
                        type="password"
                        placeholder="pt_secret_..."
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Create a token in{' '}
                        <a
                          href="https://savvycal.com/integrations"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          SavvyCal Integrations
                        </a>
                        {' '}→ Developer Settings → API → Create a token
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="webhook-secret" className="text-xs">
                        Webhook Secret (optional)
                      </Label>
                      <Input
                        id="webhook-secret"
                        type="password"
                        placeholder="whsec_..."
                        value={webhookSecret}
                        onChange={(e) => setWebhookSecret(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        For HMAC signature verification of incoming webhooks
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveApiToken}
                        disabled={isSaving || !apiToken.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowApiTokenInput(false);
                          setApiToken('');
                          setWebhookSecret('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ConfigSection>

          {/* Webhook Setup */}
          <ConfigSection title="Webhook Configuration">
            <div className="rounded-lg border-2 border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    Enable Instant Booking Sync
                  </span>
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
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-700 dark:text-gray-300">
                Add this webhook URL to SavvyCal so bookings appear instantly in your CRM.
              </p>

              {webhookUrl ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-gray-800 rounded-md border border-purple-200 dark:border-purple-700 px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                    {webhookUrl}
                  </div>
                  <Button
                    onClick={copyWebhookUrl}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 border-purple-400 dark:border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              ) : (
                <Alert className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <AlertDescription className="text-xs text-gray-600 dark:text-gray-400">
                    Add your API token above to generate your organization's unique webhook URL.
                  </AlertDescription>
                </Alert>
              )}

              {hasApiToken && webhookUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckWebhook}
                  disabled={checking}
                  className="w-full mt-2"
                >
                  {checking ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  )}
                  Verify Webhook is Installed
                </Button>
              )}

              {showWebhookGuide && (
                <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700 space-y-3">
                  <div>
                    <h5 className="font-medium text-xs text-gray-900 dark:text-white mb-2">
                      Why add this webhook?
                    </h5>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                        <span>New bookings appear instantly in your CRM</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                        <span>Contacts are automatically created or matched</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                        <span>Track lead sources based on your booking links</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium text-xs text-gray-900 dark:text-white mb-2">
                      Setup Instructions:
                    </h5>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                      <li>Copy the webhook URL above</li>
                      <li>
                        Go to your{' '}
                        <a
                          href="https://savvycal.com/integrations"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                        >
                          SavvyCal Integrations page
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                      <li>Click "Add endpoint" and paste the URL</li>
                      <li>Select the "event.created" event type</li>
                      <li>Save - new bookings will sync instantly!</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </ConfigSection>

          {/* Link Mappings */}
          <ConfigSection title="Lead Source Mappings">
            <Alert className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
              <AlertDescription className="text-xs text-gray-600 dark:text-gray-400">
                Configure which lead sources map to your SavvyCal booking links. This helps track where
                your meetings are coming from.
              </AlertDescription>
            </Alert>
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/admin/savvycal');
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Link Mappings
              </Button>
              <ProcessMapButton
                processType="integration"
                processName="savvycal"
                variant="outline"
                size="sm"
                label="View Process Map"
                className="w-full"
              />
            </div>
          </ConfigSection>
        </>
      )}
    </ConfigureModal>
  );
}
