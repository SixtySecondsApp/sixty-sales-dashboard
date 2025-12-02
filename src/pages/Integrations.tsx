import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { GoogleConnect } from '@/components/GoogleConnect';
import { FathomSettings } from '@/components/integrations/FathomSettings';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  FolderOpen,
  AlertCircle,
  ExternalLink,
  Shield,
  RefreshCw,
  ListTodo
} from 'lucide-react';
import { useGoogleIntegration } from '@/lib/stores/integrationStore';
import { GoogleServiceStatus } from '@/lib/api/googleIntegration';
import { googleTasksSync } from '@/lib/services/googleTasksSync';

export default function Integrations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tasksConnected, setTasksConnected] = useState(false);
  
  // Use the Google integration store
  const {
    isConnected,
    integration: googleIntegration,
    email,
    services,
    status,
    isLoading,
    error,
    lastSync,
    checkConnection,
    connect,
    disconnect,
    toggleService,
    clearError
  } = useGoogleIntegration();

  // Check for OAuth callback parameters
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const errorParam = searchParams.get('error');
    const emailParam = searchParams.get('email');

    if (statusParam === 'connected' && emailParam) {
      toast.success(`Successfully connected Google account: ${emailParam}`);
      // Re-check connection status after successful OAuth
      checkConnection();
      // Clean URL
      window.history.replaceState({}, '', '/integrations');
    } else if (errorParam) {
      const errorDescription = searchParams.get('error_description');
      toast.error(`Failed to connect Google: ${errorDescription || errorParam}`);
      // Clean URL
      window.history.replaceState({}, '', '/integrations');
    }
  }, [searchParams, checkConnection]);

  // Check current integration status on mount
  useEffect(() => {
    checkConnection();
    checkTasksConnection();
  }, [checkConnection]);

  const checkTasksConnection = async () => {
    try {
      const connected = await googleTasksSync.isConnected();
      setTasksConnected(connected);
    } catch (error) {
    }
  };

  // Clear error when user interacts
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000); // Auto-clear error after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Event handlers using the store
  const handleConnectGoogle = async () => {
    try {
      const authUrl = await connect();
      // Redirect to the OAuth URL
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        toast.error('Failed to get authentication URL');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate Google authentication');
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await disconnect();
      toast.success('Google account disconnected');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect Google account');
    }
  };

  const handleToggleService = async (service: keyof GoogleServiceStatus) => {
    try {
      await toggleService(service);
      
      const newValue = !services[service];
      const action = newValue ? 'enabled' : 'disabled';
      toast.success(`Google ${service.charAt(0).toUpperCase() + service.slice(1)} ${action}`);
    } catch (error: any) {
      toast.error(`Failed to toggle ${service}`);
    }
  };

  if (isLoading && status === 'disconnected') {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Integrations</h1>
        <p className="text-gray-600 dark:text-gray-400">Connect your external services to enhance your CRM experience</p>
      </div>

      {/* Google Workspace Card */}
      <Card className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50 shadow-sm dark:shadow-none dark:backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-white rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900 dark:text-gray-100">Google Workspace</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Connect Gmail, Calendar, and Drive to your CRM
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-2 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Connected</span>
                  {status === 'refreshing' && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
                </div>
              ) : status === 'error' ? (
                <div className="flex items-center space-x-2 text-red-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Connection Error</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-gray-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Not Connected</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="space-y-4">
              {/* Security Notice */}
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Secure Connection</p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Your credentials are encrypted and never stored in our frontend</li>
                      <li>• We only access the permissions you explicitly grant</li>
                      <li>• You can disconnect at any time with one click</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Services Preview */}
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Services you'll be able to use:</p>
                <div className="grid gap-3">
                  <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                    <Mail className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gmail</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send emails directly from contact pages</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Google Calendar</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Schedule meetings and sync events</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                    <FolderOpen className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Google Drive</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Access and share files</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                    <ListTodo className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Google Tasks</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sync tasks across all your devices</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connect Button */}
              <Button
                onClick={handleConnectGoogle}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect Google Workspace
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Account Info */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {email ? email[0].toUpperCase() : 'G'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{email}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {status === 'connected' ? 'Connected successfully' :
                         status === 'error' ? 'Connection error' :
                         status === 'refreshing' ? 'Refreshing...' : 'Connected'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGoogle}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Service Toggles */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enabled Services</p>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-100 dark:border-transparent">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Gmail</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send and manage emails</p>
                    </div>
                  </div>
                  <Switch
                    checked={services.gmail}
                    onCheckedChange={() => handleToggleService('gmail')}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-100 dark:border-transparent">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Google Calendar</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Schedule and sync events</p>
                    </div>
                  </div>
                  <Switch
                    checked={services.calendar}
                    onCheckedChange={() => handleToggleService('calendar')}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-100 dark:border-transparent">
                  <div className="flex items-center space-x-3">
                    <FolderOpen className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Google Drive</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Access and share files</p>
                    </div>
                  </div>
                  <Switch
                    checked={services.drive}
                    onCheckedChange={() => handleToggleService('drive')}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-100 dark:border-transparent">
                  <div className="flex items-center space-x-3">
                    <ListTodo className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Google Tasks</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sync tasks bidirectionally</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {tasksConnected ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 mr-2">Connected</span>
                    ) : (
                      <span className="text-xs text-gray-500 mr-2">Not connected</span>
                    )}
                    <Button
                      size="sm"
                      variant={tasksConnected ? "outline" : "default"}
                      onClick={() => navigate('/tasks')}
                      className="text-xs"
                    >
                      {tasksConnected ? 'Manage' : 'Setup'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Token Status */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-slate-700">
                <span>Connected: {googleIntegration && new Date(googleIntegration.created_at).toLocaleDateString()}</span>
                {googleIntegration?.expires_at && (
                  <span className="flex items-center space-x-1">
                    <RefreshCw className="w-3 h-3" />
                    <span>Token expires: {new Date(googleIntegration.expires_at).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fathom Integration */}
      <div className="mt-6">
        <FathomSettings />
      </div>

      {/* Future Integrations Placeholder */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700 rounded-lg">
        <div className="flex items-center space-x-2 text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <p className="text-sm">More integrations coming soon: Slack, Microsoft 365, Zoom, and more</p>
        </div>
      </div>
    </div>
  );
}