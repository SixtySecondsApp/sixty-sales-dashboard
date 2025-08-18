import React, { useState } from 'react';
import {
  Share,
  Copy,
  Mail,
  MessageSquare,
  ExternalLink,
  Check,
  ChevronDown,
  Hash,
  QrCode,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { RoadmapSuggestion } from '@/lib/hooks/useRoadmap';
import { copySlackMessage } from '@/lib/utils/slackIntegration';

interface TicketShareMenuProps {
  suggestion: RoadmapSuggestion;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export function TicketShareMenu({ suggestion, className = '', size = 'medium' }: TicketShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const ticketUrl = `${window.location.origin}/roadmap/ticket/${suggestion.ticket_id}`;
  const ticketTitle = `Roadmap Ticket #${suggestion.ticket_id}: ${suggestion.title}`;
  const ticketDescription = suggestion.description;

  // Size configurations
  const sizeConfig = {
    small: {
      button: 'p-1',
      icon: 'w-3 h-3',
      menu: 'w-48',
      text: 'text-xs'
    },
    medium: {
      button: 'px-2 py-1',
      icon: 'w-4 h-4', 
      menu: 'w-56',
      text: 'text-sm'
    },
    large: {
      button: 'px-3 py-2',
      icon: 'w-5 h-5',
      menu: 'w-64',
      text: 'text-base'
    }
  };

  const config = sizeConfig[size];

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(ticketUrl);
      setCopiedRecently(true);
      toast.success('Ticket URL copied to clipboard');
      setTimeout(() => setCopiedRecently(false), 2000);
      setIsOpen(false);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(ticketTitle);
    const body = encodeURIComponent(
      `Hi there,\n\nI wanted to share this roadmap ticket with you:\n\n` +
      `${ticketTitle}\n\n` +
      `Description: ${ticketDescription}\n\n` +
      `View ticket: ${ticketUrl}\n\n` +
      `Best regards`
    );
    
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    setIsOpen(false);
    toast.success('Email client opened');
  };

  const handleSlackShare = async () => {
    try {
      await copySlackMessage({
        ticketId: suggestion.ticket_id,
        title: suggestion.title,
        description: suggestion.description,
        ticketUrl,
        type: suggestion.type,
        priority: suggestion.priority,
        status: suggestion.status
      });
      
      toast.success('Slack message copied!', {
        duration: 4000,
        description: 'Formatted message with priority and type info is ready to paste in Slack.'
      });
    } catch (error) {
      console.error('Failed to copy Slack message:', error);
      // Fallback: just copy the URL
      try {
        await navigator.clipboard.writeText(`${ticketTitle}\n${ticketUrl}`);
        toast.success('Ticket info copied for Slack sharing');
      } catch (fallbackError) {
        toast.error('Failed to copy to clipboard');
      }
    }
    
    setIsOpen(false);
  };

  const handleShowQRCode = () => {
    // Generate QR code using a service like qr-server.com
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketUrl)}`;
    
    // Open QR code in a new window/tab
    const qrWindow = window.open('', '_blank', 'width=300,height=350,scrollbars=no,resizable=no');
    if (qrWindow) {
      qrWindow.document.write(`
        <html>
          <head><title>QR Code - Ticket #${suggestion.ticket_id}</title></head>
          <body style="margin:20px;text-align:center;font-family:system-ui">
            <h3>Ticket #${suggestion.ticket_id}</h3>
            <img src="${qrUrl}" alt="QR Code" style="border:1px solid #ccc;padding:10px;background:white;border-radius:8px"/>
            <p style="margin-top:15px;font-size:12px;color:#666;word-break:break-all;">${ticketUrl}</p>
            <p style="font-size:14px;color:#333;">Scan to view ticket</p>
          </body>
        </html>
      `);
      qrWindow.document.close();
    }
    
    setIsOpen(false);
    toast.success('QR code opened in new window');
  };

  const handleCopyMarkdown = async () => {
    const markdownText = `## ${ticketTitle}\n\n${ticketDescription}\n\n**Type:** ${suggestion.type} | **Priority:** ${suggestion.priority} | **Status:** ${suggestion.status}\n\n[View Ticket](${ticketUrl})`;
    
    try {
      await navigator.clipboard.writeText(markdownText);
      toast.success('Markdown copied to clipboard');
    } catch (error) {
      console.error('Failed to copy markdown:', error);
      toast.error('Failed to copy markdown');
    }
    
    setIsOpen(false);
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: ticketTitle,
          text: ticketDescription,
          url: ticketUrl,
        });
        setIsOpen(false);
      } else {
        // Fallback to copy
        handleCopyToClipboard();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error('Sharing failed');
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1 ${config.button} rounded-md
          text-gray-400 hover:text-gray-300 
          bg-gray-800/50 hover:bg-gray-700/50 
          border border-gray-700/50 hover:border-gray-600/50
          transition-all duration-200
          ${isOpen ? 'bg-gray-700/50 border-gray-600/50' : ''}
        `}
        title="Share this ticket"
      >
        {copiedRecently ? (
          <Check className={`${config.icon} text-green-400`} />
        ) : (
          <Share className={config.icon} />
        )}
        {size !== 'small' && (
          <>
            <span className={config.text}>Share</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className={`
            absolute right-0 mt-1 ${config.menu} z-20
            bg-gray-800 border border-gray-700 rounded-lg shadow-xl
            py-1 
          `}>
            {/* Ticket Info Header */}
            <div className="px-3 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Hash className="w-3 h-3" />
                <span className="font-mono">#{suggestion.ticket_id}</span>
              </div>
              <div className="text-xs text-gray-300 truncate mt-1" title={suggestion.title}>
                {suggestion.title}
              </div>
            </div>

            {/* Share Options */}
            <div className="py-1">
              {/* Copy to Clipboard */}
              <button
                onClick={handleCopyToClipboard}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <Copy className="w-4 h-4 text-blue-400" />
                <div className="flex-1 text-left">
                  <div>Copy Link</div>
                  <div className="text-xs text-gray-400">Copy URL to clipboard</div>
                </div>
              </button>

              {/* Email */}
              <button
                onClick={handleEmailShare}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <Mail className="w-4 h-4 text-green-400" />
                <div className="flex-1 text-left">
                  <div>Email</div>
                  <div className="text-xs text-gray-400">Share via email</div>
                </div>
              </button>

              {/* Slack */}
              <button
                onClick={handleSlackShare}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <div className="flex-1 text-left">
                  <div>Slack</div>
                  <div className="text-xs text-gray-400">Copy formatted message</div>
                </div>
              </button>

              {/* Divider */}
              <div className="border-t border-gray-700 my-1"></div>

              {/* QR Code */}
              <button
                onClick={handleShowQRCode}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <QrCode className="w-4 h-4 text-orange-400" />
                <div className="flex-1 text-left">
                  <div>QR Code</div>
                  <div className="text-xs text-gray-400">Generate QR for mobile</div>
                </div>
              </button>

              {/* Copy Markdown */}
              <button
                onClick={handleCopyMarkdown}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <Link2 className="w-4 h-4 text-cyan-400" />
                <div className="flex-1 text-left">
                  <div>Markdown</div>
                  <div className="text-xs text-gray-400">Copy as markdown</div>
                </div>
              </button>

              {/* Native Share (if available) */}
              {navigator.share && (
                <button
                  onClick={handleNativeShare}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1 text-left">
                    <div>More Options</div>
                    <div className="text-xs text-gray-400">System share menu</div>
                  </div>
                </button>
              )}
            </div>

            {/* URL Preview */}
            <div className="px-3 py-2 border-t border-gray-700">
              <div className="text-xs text-gray-400 break-all">
                {ticketUrl}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}