import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfigureModal, ConfigSection, DangerZone } from '@/components/integrations/ConfigureModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Users } from 'lucide-react';
import { useHubSpotIntegration } from '@/lib/hooks/useHubSpotIntegration';

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function HubSpotConfigModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const {
    integration,
    syncState,
    settings,
    webhookUrl,
    isConnected,
    canManage,
    saving,
    disconnecting,
    saveSettings,
    triggerEnsureProperties,
    triggerPollForms,
    disconnect,
    refreshStatus,
  } = useHubSpotIntegration();

  const [settingsJson, setSettingsJson] = useState<string>('{}');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSettingsJson(safeStringify(settings));
    setDirty(false);
  }, [open, settings]);

  const connectedAt = integration?.connected_at || null;
  const hubId = integration?.hubspot_hub_id || integration?.hubspot_portal_id || null;

  const connectionLabel = useMemo(() => {
    if (!isConnected) return 'Not connected';
    return hubId ? `Connected (Hub ID ${hubId})` : 'Connected';
  }, [hubId, isConnected]);

  return (
    <ConfigureModal
      open={open}
      onOpenChange={onOpenChange}
      integrationId="hubspot"
      integrationName="HubSpot"
      connectedAt={connectedAt || undefined}
      onSave={
        canManage
          ? async () => {
              const parsed = safeParseJson(settingsJson);
              if (!parsed) {
                toast.error('Settings must be valid JSON');
                return;
              }
              await saveSettings(parsed);
              setDirty(false);
            }
          : undefined
      }
      hasChanges={dirty}
      isSaving={saving}
      fallbackIcon={<Users className="w-6 h-6 text-orange-500" />}
    >
      <ConfigSection title="Connection">
        <div className="space-y-2">
          <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">{connectionLabel}</div>
          {integration?.scopes?.length ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Scopes: {integration.scopes.length}
            </div>
          ) : null}
          {webhookUrl ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Webhook URL: <span className="font-mono break-all">{webhookUrl}</span>
            </div>
          ) : null}
          {integration?.webhook_last_received_at ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last webhook: {new Date(integration.webhook_last_received_at).toLocaleString()}
            </div>
          ) : null}
          {syncState?.sync_status ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Worker status: <span className="font-semibold">{syncState.sync_status}</span>
              {syncState?.error_message ? ` · ${syncState.error_message}` : ''}
            </div>
          ) : null}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canManage || !isConnected}
              onClick={async () => {
                try {
                  await triggerEnsureProperties();
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to enqueue ensure-properties');
                }
              }}
            >
              Ensure properties
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canManage || !isConnected}
              onClick={async () => {
                try {
                  await triggerPollForms();
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to enqueue form polling');
                }
              }}
            >
              Poll forms now
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refreshStatus()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Settings (JSON)">
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure stage mappings, forms to ingest, and AI writeback toggles. This is stored per-org.
          </p>
          <Textarea
            value={settingsJson}
            onChange={(e) => {
              setSettingsJson(e.target.value);
              setDirty(true);
            }}
            rows={14}
            className="font-mono text-xs"
            disabled={!canManage}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Example keys: <span className="font-mono">pipelineStageMapping</span>, <span className="font-mono">sixtyStageToHubspot</span>, <span className="font-mono">forms</span>
          </p>
        </div>
      </ConfigSection>

      <DangerZone
        title="Disconnect HubSpot"
        description="Stops syncing and rotates the webhook token."
        buttonText="Disconnect"
        onAction={async () => {
          try {
            await disconnect();
          } catch (e: any) {
            toast.error(e?.message || 'Failed to disconnect');
          }
        }}
        isLoading={disconnecting}
        disabled={!canManage}
      />
    </ConfigureModal>
  );
}


