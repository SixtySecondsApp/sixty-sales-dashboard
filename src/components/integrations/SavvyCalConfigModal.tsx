import React, { useState } from 'react';
import {
  ConfigureModal,
  ConfigSection,
} from './ConfigureModal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Copy,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Production webhook URL
const WEBHOOK_URL = 'https://use60.com/api/webhooks/savvycal';

interface SavvyCalConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavvyCalConfigModal({ open, onOpenChange }: SavvyCalConfigModalProps) {
  const navigate = useNavigate();
  const [showWebhookGuide, setShowWebhookGuide] = useState(true);

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      toast.success('Webhook URL copied to clipboard!');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  // SavvyCal icon (purple calendar)
  const SavvyCalIcon = () => (
    <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
  );

  return (
    <ConfigureModal
      open={open}
      onOpenChange={onOpenChange}
      integrationId="savvycal"
      integrationName="SavvyCal"
      fallbackIcon={<SavvyCalIcon />}
      showFooter={false}
    >
      {/* Webhook Setup */}
      <ConfigSection title="Webhook Configuration">
        <div className="rounded-lg border-2 border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="font-semibold text-sm text-gray-900 dark:text-white">
                Enable Instant Booking Sync
              </span>
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

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-md border border-purple-200 dark:border-purple-700 px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
              {WEBHOOK_URL}
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
                      href="https://savvycal.com/app/settings/integrations/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                    >
                      SavvyCal Webhooks settings
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
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            onOpenChange(false);
            navigate('/admin/savvycal');
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Manage Link Mappings
        </Button>
      </ConfigSection>
    </ConfigureModal>
  );
}
