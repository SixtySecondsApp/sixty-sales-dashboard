import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Search, 
  Archive, 
  Trash2, 
  Star, 
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Zap,
  Clock,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Filter,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailList } from '@/components/email/EmailList';
import { EmailThread } from '@/components/email/EmailThread';
import { EmailComposerEnhanced } from '@/components/email/EmailComposerEnhanced';
import { EmailFilters } from '@/components/email/EmailFilters';
import { EmailQuickActions } from '@/components/email/EmailQuickActions';
import { 
  useGoogleIntegration,
  useGoogleOAuthInitiate,
  useGmailEmails,
  useGmailLabels,
  useGmailSend,
  useGmailMarkAsRead,
  useGmailStar,
  useGmailArchive,
  useGoogleServiceEnabled
} from '@/lib/hooks/useGoogleIntegration';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
// import { emailAIService } from '@/lib/services/emailAIService'; // TODO: Add AI categorization

export default function Email() {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  
  // Google Integration
  const { data: integration } = useGoogleIntegration();
  const isGmailEnabled = useGoogleServiceEnabled('gmail');
  const connectGoogle = useGoogleOAuthInitiate();
  
  // Build Gmail query based on folder, category, label and search
  const gmailQuery = useMemo(() => {
    let query = '';
    
    // Folder query
    if (selectedFolder === 'INBOX') query = 'in:inbox';
    else if (selectedFolder === 'SENT') query = 'in:sent';
    else if (selectedFolder === 'DRAFT') query = 'in:drafts';
    else if (selectedFolder === 'STARRED') query = 'is:starred';
    else if (selectedFolder === 'TRASH') query = 'in:trash';
    
    // Category query (Gmail categories)
    if (selectedCategory) {
      query = query ? `${query} category:${selectedCategory.toLowerCase()}` : `category:${selectedCategory.toLowerCase()}`;
    }
    
    // Label query
    if (selectedLabel) {
      query = query ? `${query} label:${selectedLabel}` : `label:${selectedLabel}`;
    }
    
    // Search query
    if (searchQuery) {
      query = query ? `${query} ${searchQuery}` : searchQuery;
    }
    
    return query || 'in:inbox';
  }, [selectedFolder, selectedCategory, selectedLabel, searchQuery]);
  
  // Fetch emails from Gmail
  const { data: gmailData, isLoading: emailsLoading, error: gmailError, refetch: refetchEmails } = useGmailEmails(
    gmailQuery,
    isGmailEnabled
  );
  
  // Debug logging
  useEffect(() => {
    if (gmailData) {
      console.log('Gmail data received:', gmailData);
    }
    if (gmailError) {
      console.error('Gmail error:', gmailError);
    }
  }, [gmailData, gmailError]);
  
  // Fetch Gmail labels
  const { data: labelsData } = useGmailLabels(isGmailEnabled);
  
  // Gmail mutations
  const sendEmail = useGmailSend();
  const markAsRead = useGmailMarkAsRead();
  const starEmailMutation = useGmailStar();
  const archiveEmailMutation = useGmailArchive();
  
  // Process Gmail data into our format with robust error handling
  const emails = useMemo(() => {
    // If Gmail is not enabled or still loading, do not show any mock data
    if (!isGmailEnabled || emailsLoading) {
      return [];
    }
    
    // If there's an error, do not show any mock data
    if (gmailError) {
      return [];
    }
    
    try {
      // Check different possible data structures from the Edge Function
      const messages = gmailData?.messages || gmailData?.emails || [];
      
      console.log('Processing Gmail messages:', messages?.length || 0);
      
      // If no messages, return empty array (not mock data) to show "no emails" state
      if (!Array.isArray(messages) || messages.length === 0) {
        console.log('No Gmail messages found');
        return []; // Return empty array instead of mock data when connected but no emails
      }
      
      return messages.map((msg: any) => {
        try {
          // The Gmail API might return messages in different formats
          // Check if we have full message data or just message IDs
          if (!msg.payload && msg.id) {
            // For now, return a placeholder
            return {
              id: msg.id,
              threadId: msg.threadId || msg.id,
              from: 'Loading...',
              fromName: 'Loading...',
              subject: 'Loading full message...',
              preview: 'Message data is being fetched...',
              timestamp: new Date(),
              read: false,
              starred: false,
              important: false,
              labels: [],
              attachments: 0,
              thread: []
            };
          }
          
          const headers = msg.payload?.headers || msg.headers || [];
      const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
      const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';
      
      // Parse the date safely
      let timestamp = new Date();
      if (dateHeader) {
        const parsedDate = new Date(dateHeader);
        if (!isNaN(parsedDate.getTime())) {
          timestamp = parsedDate;
        } else {
          console.warn('Invalid date from Gmail:', dateHeader);
        }
      } else if (msg.internalDate) {
        // Gmail API also provides internalDate as a timestamp in milliseconds
        timestamp = new Date(parseInt(msg.internalDate));
      }
      
      // Extract sender name
      const fromMatch = from.match(/^(.+?)\s*<(.+)>$/);
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, '') : from.split('@')[0];
      const fromEmail = fromMatch ? fromMatch[2] : from;
      
      // Get body content from different possible locations
      let body = msg.snippet || msg.preview || '';
      
      // Try to get body from payload if available
      if (!body && msg.payload?.body?.data) {
        try {
          body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } catch (e) {
          console.error('Failed to decode body:', e);
        }
      } else if (!body && msg.payload?.parts) {
        const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          try {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } catch (e) {
            console.error('Failed to decode part body:', e);
          }
        }
      }
      
      // Get labels and map to names
      const labelIds = msg.labelIds || [];
      
      // Map label IDs to names using labelsData
      const labels = labelIds
        .filter((id: string) => 
          !['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT'].includes(id) &&
          !id.startsWith('CATEGORY_') // Exclude category labels
        )
        .map((id: string) => {
          // Find the label name from labelsData
          const labelInfo = labelsData?.labels?.find((l: any) => l.id === id);
          return labelInfo ? labelInfo.name : id; // Use name if found, otherwise use ID
        });
      
      // AI categorization
      const aiData = {
        subject,
        from: fromEmail,
        body,
        labels: labelIds
      };
      
          return {
            id: msg.id,
            threadId: msg.threadId,
            from: fromEmail,
            fromName,
            subject,
            preview: body,
            timestamp,
            read: !labelIds.includes('UNREAD'),
            starred: labelIds.includes('STARRED'),
            important: labelIds.includes('IMPORTANT'),
            labels,
            attachments: msg.payload?.parts?.filter((p: any) => p.filename).length || 0,
            thread: [{
              id: msg.id,
              from: fromEmail,
              fromName,
              content: body,
              timestamp,
              attachments: msg.payload?.parts?.filter((p: any) => p.filename).map((p: any) => p.filename) || []
            }]
          };
        } catch (error) {
          console.error('Error processing email message:', error, msg);
          // Return a fallback email object
          return {
            id: msg.id || `error-${Date.now()}`,
            threadId: msg.threadId || msg.id,
            from: 'unknown@email.com',
            fromName: 'Unknown Sender',
            subject: '(Error loading email)',
            preview: 'There was an error loading this email',
            timestamp: new Date(),
            read: true,
            starred: false,
            important: false,
            labels: [],
            attachments: 0,
            thread: []
          };
        }
      });
    } catch (error) {
      console.error('Error processing Gmail data:', error);
      return [];
    }
  }, [gmailData, isGmailEnabled, labelsData, emailsLoading, gmailError]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'j':
        // Select next email
        if (selectedEmail) {
          const currentIndex = emails.findIndex(email => email.id === selectedEmail);
          const nextIndex = Math.min(currentIndex + 1, emails.length - 1);
          setSelectedEmail(emails[nextIndex].id);
        } else if (emails.length > 0) {
          setSelectedEmail(emails[0].id);
        }
        break;
      case 'k':
        // Select previous email
        if (selectedEmail) {
          const currentIndex = emails.findIndex(email => email.id === selectedEmail);
          const prevIndex = Math.max(currentIndex - 1, 0);
          setSelectedEmail(emails[prevIndex].id);
        }
        break;
      case 'c':
        // Compose new email
        setIsComposerOpen(true);
        break;
      case 'e':
        // Archive email
        if (selectedEmail) {
          handleArchiveEmail(selectedEmail);
        }
        break;
      case 's':
        // Star email
        if (selectedEmail) {
          handleStarEmail(selectedEmail);
        }
        break;
      case 'r':
        // Refresh
        handleRefresh();
        break;
      case '/':
        // Focus search
        e.preventDefault();
        document.getElementById('email-search')?.focus();
        break;
    }
  }, [selectedEmail, emails]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const handleArchiveEmail = async (emailId: string) => {
    if (isGmailEnabled) {
      try {
        await archiveEmailMutation.mutateAsync(emailId);
        toast.success('Email archived');
      } catch (error) {
        toast.error('Failed to archive email');
      }
    } else {
      toast.info('Connect Gmail to archive emails');
    }
    if (selectedEmail === emailId) {
      setSelectedEmail(null);
    }
  };

  const handleStarEmail = async (emailId: string, starred: boolean) => {
    if (isGmailEnabled) {
      try {
        await starEmailMutation.mutateAsync({ messageId: emailId, starred });
        toast.success(starred ? 'Starred' : 'Unstarred');
      } catch (error) {
        toast.error('Failed to update star status');
      }
    } else {
      toast.info('Connect Gmail to star emails');
    }
  };

  const handleMarkRead = async (emailId: string, read: boolean) => {
    if (isGmailEnabled) {
      try {
        await markAsRead.mutateAsync({ messageId: emailId, read });
        toast.success(read ? 'Marked as read' : 'Marked as unread');
      } catch (error) {
        toast.error('Failed to update read status');
      }
    } else {
      toast.info('Connect Gmail to update read status');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (isGmailEnabled) {
      await refetchEmails();
      toast.success('Emails refreshed');
    } else {
      toast.info('Connect Gmail to refresh');
    }
    setIsRefreshing(false);
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.fromName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.preview.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesReadFilter = readFilter === 'all' || 
                             (readFilter === 'unread' && !email.read) ||
                             (readFilter === 'read' && email.read);
    
    return matchesSearch && matchesReadFilter;
  });

  const selectedEmailData = selectedEmail ? emails.find(email => email.id === selectedEmail) : null;
  const unreadCount = emails.filter(email => !email.read).length;

  return (
    <div className="h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Google Connection Banner */}
      {!isGmailEnabled && (
        <div className="bg-yellow-50 dark:bg-yellow-500/10 border-b border-yellow-200 dark:border-yellow-500/20 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-500">Gmail Not Connected</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Connect your Google account to access your real emails</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => connectGoogle.mutate()}
              disabled={connectGoogle.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {connectGoogle.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Connect Gmail
                </>
              )}
            </motion.button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="h-14 sm:h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors"
          >
            {isSidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </motion.button>

          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Email</h1>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full"
              >
                {unreadCount}
              </motion.span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="email-search"
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-80 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(true)}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors"
              title="Email filters"
            >
              <Filter className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsComposerOpen(true)}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors"
              title="Compose email"
            >
              <Edit className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={isRefreshing || emailsLoading}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors disabled:opacity-50"
              title="Refresh emails"
            >
              <RefreshCw className={cn("w-5 h-5", (isRefreshing || emailsLoading) && "animate-spin")} />
            </motion.button>
            
            {/* Debug button */}
            {isGmailEnabled && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  console.log('Testing Gmail API directly...');
                  try {
                    // Test with the exact format expected by the Edge Function
                    const response = await supabase.functions.invoke('google-gmail?action=list', {
                      body: { 
                        query: 'in:inbox',
                        maxResults: 10
                      }
                    });
                    console.log('Direct API response:', response);
                    
                    if (response.error) {
                      console.error('Error details:', response.error);
                      toast.error(`API Error: ${response.error.message || response.error}`);
                      
                      // Check if it's an authentication issue
                      if (response.error.message?.includes('token') || response.error.message?.includes('auth')) {
                        toast.info('Try reconnecting your Google account in Settings');
                      }
                    } else if (response.data) {
                      console.log('Success! Data structure:', {
                        hasMessages: !!response.data.messages,
                        hasEmails: !!response.data.emails,
                        isArray: Array.isArray(response.data),
                        keys: Object.keys(response.data)
                      });
                      toast.success('Check console for API response structure');
                    }
                  } catch (err) {
                    console.error('Direct API error:', err);
                    toast.error('Failed to call Gmail API');
                  }
                }}
                className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
                title="Test Gmail API"
              >
                <Zap className="w-5 h-5" />
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsComposerOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Compose
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <AnimatePresence>
          {!isSidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Folders */}
                <div className="space-y-1">
                  {[
                    { id: 'INBOX', label: 'Inbox', icon: Mail, count: unreadCount },
                    { id: 'STARRED', label: 'Starred', icon: Star, count: emails.filter(e => e.starred).length },
                    { id: 'SENT', label: 'Sent', icon: Archive, count: 0 },
                    { id: 'TRASH', label: 'Trash', icon: Trash2, count: 0 },
                  ].map((folder) => (
                    <motion.button
                      key={folder.id}
                      whileHover={{ x: 4 }}
                      onClick={() => setSelectedFolder(folder.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        selectedFolder === folder.id
                          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                          : 'text-gray-400 hover:bg-gray-700'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <folder.icon className="w-4 h-4" />
                        {folder.label}
                      </div>
                      {folder.count > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full">
                          {folder.count}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Filters */}
                <div className="border-t border-gray-800/50 pt-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Filters</h3>
                  <div className="space-y-1">
                    {[
                      { id: 'all', label: 'All', icon: Mail },
                      { id: 'unread', label: 'Unread', icon: Eye },
                      { id: 'read', label: 'Read', icon: EyeOff },
                    ].map((filter) => (
                      <motion.button
                        key={filter.id}
                        whileHover={{ x: 4 }}
                        onClick={() => setReadFilter(filter.id as any)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          readFilter === filter.id
                            ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                            : 'text-gray-400 hover:bg-gray-700'
                        )}
                      >
                        <filter.icon className="w-4 h-4" />
                        {filter.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Gmail Categories */}
                {isGmailEnabled && (
                  <div className="border-t border-gray-800/50 pt-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</h3>
                    <div className="space-y-1">
                      {[
                        { id: 'primary', label: 'Primary', color: 'blue' },
                        { id: 'social', label: 'Social', color: 'cyan' },
                        { id: 'promotions', label: 'Promotions', color: 'green' },
                        { id: 'updates', label: 'Updates', color: 'yellow' },
                        { id: 'forums', label: 'Forums', color: 'purple' },
                      ].map((category) => (
                        <motion.button
                          key={category.id}
                          whileHover={{ x: 4 }}
                          onClick={() => {
                            setSelectedCategory(selectedCategory === category.id ? null : category.id);
                            setSelectedLabel(null); // Clear label when selecting category
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            selectedCategory === category.id
                              ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                              : 'text-gray-400 hover:bg-gray-700'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-2 h-2 rounded-full',
                              category.color === 'blue' && 'bg-blue-500',
                              category.color === 'cyan' && 'bg-cyan-500',
                              category.color === 'green' && 'bg-green-500',
                              category.color === 'yellow' && 'bg-yellow-500',
                              category.color === 'purple' && 'bg-purple-500'
                            )} />
                            {category.label}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gmail Labels */}
                {isGmailEnabled && labelsData?.labels && (
                  <div className="border-t border-gray-800/50 pt-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Labels</h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {labelsData.labels
                        .filter((label: any) => 
                          label.type === 'user' && 
                          !['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT'].includes(label.id)
                        )
                        .map((label: any) => (
                          <motion.button
                            key={label.id}
                            whileHover={{ x: 4 }}
                            onClick={() => {
                              setSelectedLabel(selectedLabel === label.id ? null : label.id);
                              setSelectedCategory(null); // Clear category when selecting label
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                              selectedLabel === label.id
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                                : 'text-gray-400 hover:bg-gray-700'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {label.color?.backgroundColor && (
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: label.color.backgroundColor }}
                                />
                              )}
                              <span className="truncate">{label.name}</span>
                            </div>
                            {label.messagesUnread > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full">
                                {label.messagesUnread}
                              </span>
                            )}
                          </motion.button>
                        ))}
                    </div>
                  </div>
                )}

                {/* AI Features */}
                <div className="border-t border-gray-800/50 pt-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Features</h3>
                  <div className="space-y-1">
                    <motion.button
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-700 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      Smart Replies
                    </motion.button>
                    <motion.button
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-700 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      Send Later
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email List */}
        <div className={cn(
          'border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900',
          selectedEmail ? 'w-96' : 'flex-1'
        )}>
          <EmailList
            emails={filteredEmails}
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onMarkRead={handleMarkRead}
            onStarEmail={handleStarEmail}
            onArchiveEmail={handleArchiveEmail}
            searchQuery={searchQuery}
          />
        </div>

        {/* Email Thread */}
        <AnimatePresence>
          {selectedEmail && selectedEmailData && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 bg-white dark:bg-gray-950 overflow-hidden"
            >
              <EmailThread
                email={selectedEmailData}
                onClose={() => setSelectedEmail(null)}
                onMarkRead={handleMarkRead}
                onStarEmail={handleStarEmail}
                onArchiveEmail={handleArchiveEmail}
                onReply={() => setIsComposerOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Email Composer */}
      <EmailComposerEnhanced
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        replyTo={selectedEmailData}
      />

      {/* Email Filters */}
      <EmailFilters
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* Quick Actions Guide */}
      <EmailQuickActions />

      {/* Connection Status - Moved to bottom */}
      {integration && isGmailEnabled && (
        <div className="bg-blue-600/10 border-t border-blue-500/20 px-6 py-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#37bd7e]" />
              <p className="text-sm text-[#37bd7e]">Connected to {integration.email}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/integrations')}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Manage
            </motion.button>
          </div>
        </div>
      )}

    </div>
  );
}