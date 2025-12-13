import React, { useState, useEffect } from 'react';
import {
  ConfigureModal,
  ConfigSection,
  ConfigToggle,
  DangerZone,
} from './ConfigureModal';
import { Button } from '@/components/ui/button';
import { useGoogleIntegration } from '@/lib/stores/integrationStore';
import { GoogleServiceStatus } from '@/lib/api/googleIntegration';
import { Mail, Calendar, FolderOpen, ListTodo, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface GoogleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleConfigModal({ open, onOpenChange }: GoogleConfigModalProps) {
  const navigate = useNavigate();
  const {
    integration,
    email,
    services,
    isLoading,
    disconnect,
    toggleService,
  } = useGoogleIntegration();

  const [localServices, setLocalServices] = useState<GoogleServiceStatus>(services);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Sync local state with store
  useEffect(() => {
    setLocalServices(services);
  }, [services]);

  const hasChanges =
    localServices.gmail !== services.gmail ||
    localServices.calendar !== services.calendar ||
    localServices.drive !== services.drive;

  const handleToggle = (service: keyof GoogleServiceStatus) => {
    setLocalServices((prev) => ({
      ...prev,
      [service]: !prev[service],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Toggle each service that changed
      const serviceKeys: (keyof GoogleServiceStatus)[] = ['gmail', 'calendar', 'drive'];
      for (const key of serviceKeys) {
        if (localServices[key] !== services[key]) {
          await toggleService(key);
        }
      }
      toast.success('Settings saved successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
      toast.success('Google account disconnected');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Google multi-color logo SVG
  const GoogleLogo = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  return (
    <ConfigureModal
      open={open}
      onOpenChange={onOpenChange}
      integrationId="google-workspace"
      integrationName="Google Workspace"
      connectedEmail={email || undefined}
      fallbackIcon={<GoogleLogo />}
      onSave={handleSave}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* Services Section */}
      <ConfigSection title="Enabled Services">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Gmail</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Send emails directly from contact pages
                </p>
              </div>
            </div>
            <ConfigToggle
              label=""
              checked={localServices.gmail}
              onChange={() => handleToggle('gmail')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Google Calendar
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Schedule meetings and sync events
                </p>
              </div>
            </div>
            <ConfigToggle
              label=""
              checked={localServices.calendar}
              onChange={() => handleToggle('calendar')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center space-x-3">
              <FolderOpen className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Google Drive</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Access and share files
                </p>
              </div>
            </div>
            <ConfigToggle
              label=""
              checked={localServices.drive}
              onChange={() => handleToggle('drive')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center space-x-3">
              <ListTodo className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Google Tasks</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Sync tasks bidirectionally
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                navigate('/tasks');
              }}
              className="text-xs"
            >
              Manage
            </Button>
          </div>
        </div>
      </ConfigSection>

      {/* Connection Info */}
      <ConfigSection title="Connection Info">
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Connected:</span>
            <span>
              {integration && new Date(integration.created_at).toLocaleDateString()}
            </span>
          </div>
          {integration?.expires_at && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Token expires:
              </span>
              <span>{new Date(integration.expires_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* Danger Zone */}
      <DangerZone
        title="Disconnect Google"
        description="Stops Gmail, Calendar, and Drive sync."
        buttonText="Disconnect"
        onAction={handleDisconnect}
        isLoading={isDisconnecting}
      />
    </ConfigureModal>
  );
}
