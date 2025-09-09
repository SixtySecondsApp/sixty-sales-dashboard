import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { googleOAuthService } from '../../lib/services/googleOAuthService';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface GoogleIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onIntegrationComplete?: () => void;
}

export const GoogleIntegrationModal: React.FC<GoogleIntegrationModalProps> = ({
  isOpen,
  onClose,
  userId,
  onIntegrationComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [integrationDetails, setIntegrationDetails] = useState<any>(null);
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkExistingIntegration();
      generateAuthUrl();
    }
  }, [isOpen, userId]);

  const checkExistingIntegration = async () => {
    try {
      const hasValid = await googleOAuthService.hasValidIntegration(userId);
      setHasIntegration(hasValid);
      
      if (hasValid) {
        const integration = await googleOAuthService.getTokens(userId);
        setIntegrationDetails(integration);
      }
    } catch (error) {
      console.error('Error checking integration:', error);
    }
  };

  const generateAuthUrl = () => {
    const state = btoa(JSON.stringify({ userId, timestamp: Date.now() }));
    const url = googleOAuthService.getAuthorizationUrl(state);
    setAuthUrl(url);
  };

  const handleAuthorize = () => {
    // Store callback data in localStorage for the callback page
    localStorage.setItem('google_oauth_callback', JSON.stringify({
      userId,
      redirectTo: window.location.pathname,
    }));
    
    // Open OAuth flow in new window
    const authWindow = window.open(authUrl, 'GoogleAuth', 'width=600,height=700');
    
    // Check for completion
    const checkInterval = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkInterval);
        checkExistingIntegration();
        onIntegrationComplete?.();
      }
    }, 1000);
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await googleOAuthService.revokeAuthorization(userId);
      setHasIntegration(false);
      setIntegrationDetails(null);
      toast.success('Google integration disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect Google integration');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Google Workspace Integration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {hasIntegration ? (
          <div className="space-y-6">
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-green-400 font-medium">Google Workspace Connected</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Connected as: {integrationDetails?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Available Services</h3>
              <div className="grid grid-cols-2 gap-3">
                <ServiceItem
                  name="Google Docs"
                  description="Create and manage documents"
                  enabled={true}
                />
                <ServiceItem
                  name="Google Drive"
                  description="Store and organize files"
                  enabled={true}
                />
                <ServiceItem
                  name="Gmail"
                  description="Send and manage emails"
                  enabled={true}
                />
                <ServiceItem
                  name="Google Calendar"
                  description="Schedule and manage events"
                  enabled={true}
                />
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Permissions</h3>
              <div className="space-y-2 text-sm">
                <PermissionItem text="Create and edit Google Docs" />
                <PermissionItem text="Upload and manage files in Google Drive" />
                <PermissionItem text="Send emails on your behalf" />
                <PermissionItem text="Create and manage calendar events" />
                <PermissionItem text="Read your email labels and folders" />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Disconnect Integration
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-blue-400 font-medium">Connect Google Workspace</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Integrate with Google Docs, Drive, Gmail, and Calendar to automate your workflows
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">What you'll be able to do:</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Create Google Docs from templates with variable replacement</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Organize documents in Google Drive folders</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Send personalized emails through Gmail</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Create calendar events and send invitations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Export documents as PDFs and attach to emails</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Required Permissions</h3>
              <p className="text-gray-400 text-sm mb-3">
                This integration will request access to:
              </p>
              <div className="space-y-2 text-sm">
                <PermissionItem text="Create, read, update, and delete Google Docs" />
                <PermissionItem text="Upload, organize, and manage files in Google Drive" />
                <PermissionItem text="Send emails and manage drafts in Gmail" />
                <PermissionItem text="Create, update, and delete calendar events" />
                <PermissionItem text="View your email address and profile information" />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleAuthorize}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="w-4 h-4"
                />
                Connect with Google
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ServiceItem: React.FC<{
  name: string;
  description: string;
  enabled: boolean;
}> = ({ name, description, enabled }) => (
  <div className="flex items-start gap-3 p-3 bg-gray-700/50 rounded">
    <div className={`w-2 h-2 rounded-full mt-1.5 ${enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
    <div>
      <p className="text-white font-medium text-sm">{name}</p>
      <p className="text-gray-400 text-xs mt-0.5">{description}</p>
    </div>
  </div>
);

const PermissionItem: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-start gap-2 text-gray-400">
    <div className="w-1 h-1 rounded-full bg-gray-500 mt-1.5" />
    <span>{text}</span>
  </div>
);