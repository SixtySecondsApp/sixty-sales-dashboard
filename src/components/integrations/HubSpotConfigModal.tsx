import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfigureModal, ConfigSection, DangerZone } from '@/components/integrations/ConfigureModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Settings2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useHubSpotIntegration } from '@/lib/hooks/useHubSpotIntegration';
import { ProcessMapButton } from '@/components/process-maps';

export function HubSpotConfigModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const {
    integration,
    syncState,
    settings,
    webhookUrl,
    isConnected,
    canManage,
    saving,
    disconnecting,
    triggerEnsureProperties,
    triggerPollForms,
    disconnect,
    refreshStatus,
    loading,
  } = useHubSpotIntegration();

  const connectedAt = integration?.connected_at || null;
  const hubId = integration?.hubspot_hub_id || integration?.hubspot_portal_id || null;
  const accountName = integration?.hubspot_account_name;
  const scopeCount = integration?.scopes?.length || 0;
  const lastSync = syncState?.last_sync_completed_at;
  const syncStatus = syncState?.sync_status || 'idle';

  const connectionLabel = useMemo(() => {
    if (!isConnected) return 'Not connected';
    return hubId ? `Hub ID: ${hubId}` : 'Connected';
  }, [hubId, isConnected]);

  // Count enabled features from settings
  const enabledFeatures = useMemo(() => {
    const features: string[] = [];
    if (settings?.pipeline_mapping?.enabled) features.push('Pipeline Mapping');
    if (settings?.contact_sync?.enabled) features.push('Contact Sync');
    if (settings?.deal_sync?.enabled) features.push('Deal Sync');
    if (settings?.task_sync?.enabled) features.push('Task Sync');
    if (settings?.form_ingestion?.enabled) features.push('Form Ingestion');
    if (settings?.ai_note_writeback?.enabled) features.push('AI Notes');
    return features;
  }, [settings]);

  const handleGoToSettings = () => {
    onOpenChange(false);
    navigate('/settings/integrations/hubspot');
  };

  return (
    <ConfigureModal
      open={open}
      onOpenChange={onOpenChange}
      integrationId="hubspot"
      integrationName="HubSpot"
      connectedAt={connectedAt || undefined}
      hasChanges={false}
      isSaving={saving}
      fallbackIcon={<Users className="w-6 h-6 text-orange-500" />}
    >
      {/* Connection Status */}
      <ConfigSection title="Connection Status">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {isConnected ? 'Connected' : 'Not Connected'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {connectionLabel}
                  {accountName && ` • ${accountName}`}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshStatus()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {isConnected && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Sync Status</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      syncStatus === 'syncing'
                        ? 'bg-amber-500 animate-pulse'
                        : syncStatus === 'error'
                        ? 'bg-destructive'
                        : 'bg-green-500'
                    }`}
                  />
                  <span className="text-sm font-medium capitalize">{syncStatus}</span>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Scopes</div>
                <div className="text-sm font-medium mt-1">{scopeCount} granted</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Last Sync</div>
                <div className="text-sm font-medium mt-1">
                  {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Features</div>
                <div className="text-sm font-medium mt-1">
                  {enabledFeatures.length > 0 ? `${enabledFeatures.length} enabled` : 'None configured'}
                </div>
              </div>
            </div>
          )}

          {syncState?.error_message && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-xs text-destructive">{syncState.error_message}</div>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* Quick Actions */}
      {isConnected && (
        <ConfigSection title="Quick Actions">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canManage}
                onClick={async () => {
                  try {
                    await triggerEnsureProperties();
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to ensure properties');
                  }
                }}
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Ensure Properties
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canManage}
                onClick={async () => {
                  try {
                    await triggerPollForms();
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to poll forms');
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Poll Forms
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={`https://app.hubspot.com/contacts/${integration?.hubspot_portal_id || integration?.hubspot_hub_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open HubSpot
                </a>
              </Button>
              <ProcessMapButton
                processType="integration"
                processName="hubspot"
                variant="outline"
                size="sm"
                label="Process Map"
              />
            </div>
          </div>
        </ConfigSection>
      )}

      {/* Enabled Features Summary */}
      {isConnected && enabledFeatures.length > 0 && (
        <ConfigSection title="Enabled Features">
          <div className="flex flex-wrap gap-1.5">
            {enabledFeatures.map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {feature}
              </Badge>
            ))}
          </div>
        </ConfigSection>
      )}

      {/* Settings Link */}
      <ConfigSection title="Configuration">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure pipeline mapping, contact sync, deal sync, form ingestion, and AI note writeback on the dedicated settings page.
          </p>
          <Button
            onClick={handleGoToSettings}
            className="w-full"
            disabled={!isConnected}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Configure HubSpot Settings
          </Button>
        </div>
      </ConfigSection>

      {/* Webhook URL (collapsed by default) */}
      {isConnected && webhookUrl && (
        <ConfigSection title="Webhook URL">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded truncate">
                {webhookUrl}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success('Webhook URL copied');
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure this URL in your HubSpot webhook settings to receive real-time updates.
            </p>
          </div>
        </ConfigSection>
      )}

      {/* Danger Zone */}
      {isConnected && (
        <DangerZone
          title="Disconnect HubSpot"
          description="This will stop all sync operations and rotate the webhook token. You'll need to reconnect to resume syncing."
          buttonText="Disconnect"
          onAction={async () => {
            try {
              await disconnect();
              toast.success('HubSpot disconnected');
            } catch (e: any) {
              toast.error(e?.message || 'Failed to disconnect');
            }
          }}
          isLoading={disconnecting}
          disabled={!canManage}
        />
      )}
    </ConfigureModal>
  );
}
