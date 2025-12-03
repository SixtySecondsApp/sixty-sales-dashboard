import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Loader2, 
  AlertCircle,
  ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
// TODO: Tooltip component not implemented yet
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger
// } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import EmailComposerModal from './EmailComposerModal';

interface SendEmailButtonProps {
  contactEmail: string;
  contactName?: string;
  contactId?: string;
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  showLabel?: boolean;
  onEmailSent?: (messageId: string) => void;
}

interface GoogleIntegrationStatus {
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  userEmail?: string;
}

const SendEmailButton: React.FC<SendEmailButtonProps> = ({
  contactEmail,
  contactName,
  contactId,
  variant = 'default',
  size = 'md',
  className = '',
  disabled = false,
  showLabel = true,
  onEmailSent
}) => {
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus>({
    isConnected: false,
    loading: true,
    error: null
  });
  
  const [showComposer, setShowComposer] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkGoogleIntegration = async () => {
    setChecking(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setGoogleStatus({
          isConnected: false,
          loading: false,
          error: 'User not authenticated'
        });
        return;
      }

      // Check for Google integration
      const { data: integration, error: integrationError } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (integrationError) {
        if (integrationError.code === 'PGRST116') {
          // No integration found
          setGoogleStatus({
            isConnected: false,
            loading: false,
            error: 'Google integration not found'
          });
        } else {
          setGoogleStatus({
            isConnected: false,
            loading: false,
            error: 'Failed to check Google integration'
          });
        }
        return;
      }

      // Check if tokens are still valid (basic check)
      const now = new Date();
      const expiresAt = new Date(integration?.expires_at || '');
      const isExpired = expiresAt <= now;

      if (isExpired && !integration?.refresh_token) {
        setGoogleStatus({
          isConnected: false,
          loading: false,
          error: 'Google integration expired'
        });
        return;
      }

      setGoogleStatus({
        isConnected: true,
        loading: false,
        error: null,
        userEmail: integration?.email || ''
      });

    } catch (error) {
      setGoogleStatus({
        isConnected: false,
        loading: false,
        error: 'Failed to check Google integration'
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkGoogleIntegration();
  }, []);

  const handleEmailClick = () => {
    if (!googleStatus.isConnected) {
      if (googleStatus.error) {
        toast.error(googleStatus.error);
      } else {
        toast.error('Google integration required to send emails');
      }
      return;
    }

    setShowComposer(true);
  };

  const handleEmailSent = (messageId: string) => {
    if (onEmailSent) {
      onEmailSent(messageId);
    }
    
    // Show success message
    toast.success('Email sent successfully!');
  };

  const getButtonContent = () => {
    if (googleStatus.loading || checking) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {showLabel && size !== 'icon' && <span>Checking...</span>}
        </>
      );
    }

    if (!googleStatus.isConnected) {
      return (
        <>
          <AlertCircle className="h-4 w-4" />
          {showLabel && size !== 'icon' && <span>No Gmail</span>}
        </>
      );
    }

    return (
      <>
        <Mail className="h-4 w-4" />
        {showLabel && size !== 'icon' && <span>Send Email</span>}
      </>
    );
  };

  const getTooltipContent = () => {
    if (googleStatus.loading || checking) {
      return 'Checking Google integration...';
    }
    
    if (googleStatus.error) {
      return googleStatus.error;
    }
    
    if (!googleStatus.isConnected) {
      return 'Connect Google account to send emails';
    }
    
    return `Send email to ${contactEmail}${googleStatus.userEmail ? ` from ${googleStatus.userEmail}` : ''}`;
  };

  const isDisabled = disabled || googleStatus.loading || checking || !googleStatus.isConnected;

  // Map 'md' size to 'default' for Button component compatibility
  const buttonSize = size === 'md' ? 'default' : size;

  return (
    <TooltipProvider>
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={buttonSize as 'default' | 'sm' | 'lg' | 'icon'}
              onClick={handleEmailClick}
              disabled={isDisabled}
              className={`relative ${className} ${
                !googleStatus.isConnected && !googleStatus.loading 
                  ? 'opacity-60 cursor-not-allowed' 
                  : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {getButtonContent()}
              </div>
              
              {googleStatus.isConnected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-center">
              <p>{getTooltipContent()}</p>
              {googleStatus.isConnected && googleStatus.userEmail && (
                <p className="text-xs text-slate-400 mt-1">
                  Connected as {googleStatus.userEmail}
                </p>
              )}
              {!googleStatus.isConnected && !googleStatus.loading && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Setup required
                  </Badge>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Email Composer Modal */}
        <EmailComposerModal
          isOpen={showComposer}
          onClose={() => setShowComposer(false)}
          contactEmail={contactEmail}
          contactName={contactName}
          onSent={handleEmailSent}
        />

        {/* Connection Status Indicator */}
        {!googleStatus.loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-1 -right-1"
          >
            {googleStatus.isConnected ? (
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            ) : (
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            )}
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SendEmailButton;