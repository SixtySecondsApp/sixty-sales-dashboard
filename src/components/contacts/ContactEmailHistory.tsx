import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  Inbox,
  Send,
  Search,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { googleEmailService, ContactEmail } from '@/lib/services/googleEmailService';
import { formatDistanceToNow, format } from 'date-fns';

interface ContactEmailHistoryProps {
  contactId: string;
  contactName?: string;
  className?: string;
}

interface EmailFilters {
  direction: 'all' | 'inbound' | 'outbound';
  readStatus: 'all' | 'read' | 'unread';
  search: string;
}

const ContactEmailHistory: React.FC<ContactEmailHistoryProps> = ({
  contactId,
  contactName,
  className = ""
}) => {
  const [emails, setEmails] = useState<ContactEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [filters, setFilters] = useState<EmailFilters>({
    direction: 'all',
    readStatus: 'all',
    search: ''
  });
  
  const emailsPerPage = 20;
  const hasNextPage = currentPage * emailsPerPage < totalEmails;
  const hasPrevPage = currentPage > 1;

  const loadEmails = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const fetchedEmails = await googleEmailService.getContactEmails(
        contactId, 
        emailsPerPage * currentPage
      );
      
      const filteredEmails = filterEmails(fetchedEmails);
      setEmails(filteredEmails);
      setTotalEmails(fetchedEmails.length);
    } catch (error) {
      toast.error('Failed to load email history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterEmails = (emailList: ContactEmail[]): ContactEmail[] => {
    return emailList.filter(email => {
      // Direction filter
      if (filters.direction !== 'all' && email.direction !== filters.direction) {
        return false;
      }

      // Read status filter
      if (filters.readStatus === 'read' && !email.is_read) return false;
      if (filters.readStatus === 'unread' && email.is_read) return false;

      // Search filter
      if (filters.search.trim()) {
        const searchLower = filters.search.toLowerCase();
        return (
          email.subject.toLowerCase().includes(searchLower) ||
          email.from_email.toLowerCase().includes(searchLower) ||
          (email.from_name && email.from_name.toLowerCase().includes(searchLower)) ||
          (email.body_plain && email.body_plain.toLowerCase().includes(searchLower))
        );
      }

      return true;
    });
  };

  useEffect(() => {
    if (contactId) {
      loadEmails();
    }
  }, [contactId, currentPage]);

  useEffect(() => {
    // Reapply filters when filters change
    if (emails.length > 0) {
      const filtered = filterEmails(emails);
      setEmails(filtered);
    }
  }, [filters]);

  const handleEmailExpand = (emailId: string) => {
    const newExpanded = new Set(expandedEmails);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
      // Mark as read when expanded
      markAsRead(emailId);
    }
    setExpandedEmails(newExpanded);
  };

  const markAsRead = async (emailId: string) => {
    try {
      await googleEmailService.markEmailAsRead(emailId);
      setEmails(prev => 
        prev.map(email => 
          email.id === emailId ? { ...email, is_read: true } : email
        )
      );
    } catch (error) {
    }
  };

  const getEmailDirection = (email: ContactEmail) => {
    return email.direction === 'inbound' ? 'received' : 'sent';
  };

  const getDirectionIcon = (direction: 'inbound' | 'outbound') => {
    return direction === 'inbound' ? (
      <ArrowLeft className="h-4 w-4 text-green-400" />
    ) : (
      <ArrowRight className="h-4 w-4 text-blue-400" />
    );
  };

  const getDirectionColor = (direction: 'inbound' | 'outbound') => {
    return direction === 'inbound' 
      ? 'bg-green-500/10 text-green-400 border-green-500/20' 
      : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  const formatEmailDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const paginatedEmails = emails.slice(
    (currentPage - 1) * emailsPerPage,
    currentPage * emailsPerPage
  );

  if (loading) {
    return (
      <Card className={`bg-slate-900/50 backdrop-blur-sm border-slate-700/50 ${className}`}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Email History</h3>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full bg-slate-800" />
                <Skeleton className="h-3 w-3/4 bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`bg-slate-900/50 backdrop-blur-sm border-slate-700/50 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Mail className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Email History</h3>
              {contactName && (
                <p className="text-sm text-slate-400">
                  {totalEmails} emails with {contactName}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadEmails(true)}
            disabled={refreshing}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search emails..."
                className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50"
              />
            </div>
          </div>
          
          <Select
            value={filters.direction}
            onValueChange={(value: 'all' | 'inbound' | 'outbound') => 
              setFilters(prev => ({ ...prev, direction: value }))
            }
          >
            <SelectTrigger className="w-[130px] bg-slate-800/50 border-slate-700/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All emails</SelectItem>
              <SelectItem value="inbound">Received</SelectItem>
              <SelectItem value="outbound">Sent</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.readStatus}
            onValueChange={(value: 'all' | 'read' | 'unread') => 
              setFilters(prev => ({ ...prev, readStatus: value }))
            }
          >
            <SelectTrigger className="w-[100px] bg-slate-800/50 border-slate-700/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Email List */}
        {paginatedEmails.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-slate-400 mb-2">No emails found</h4>
            <p className="text-slate-500">
              {filters.search || filters.direction !== 'all' || filters.readStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Email history will appear here once synced'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {paginatedEmails.map((email) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`border rounded-lg transition-all duration-200 hover:border-slate-600/50 ${
                    email.is_read 
                      ? 'border-slate-700/50 bg-slate-800/30' 
                      : 'border-slate-600/50 bg-slate-800/50'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => handleEmailExpand(email.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-1">
                          {getDirectionIcon(email.direction)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getDirectionColor(email.direction)}`}
                            >
                              {getEmailDirection(email)}
                            </Badge>
                            {!email.is_read && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                                unread
                              </Badge>
                            )}
                          </div>
                          
                          <h4 className={`font-medium truncate ${email.is_read ? 'text-slate-300' : 'text-white'}`}>
                            {email.subject || '(No subject)'}
                          </h4>
                          
                          <p className="text-sm text-slate-400 truncate">
                            {email.direction === 'inbound' 
                              ? `From: ${email.from_name || email.from_email}`
                              : `To: ${email.to_emails.join(', ')}`}
                          </p>
                          
                          {email.body_plain && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                              {truncateText(email.body_plain, 120)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-400">
                          {formatEmailDate(email.sent_at)}
                        </span>
                        {expandedEmails.has(email.id) ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedEmails.has(email.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-700/50"
                      >
                        <div className="p-4 bg-slate-800/20">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                              <span className="font-medium text-slate-300">From:</span>
                              <p className="text-slate-400 break-all">
                                {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-300">To:</span>
                              <p className="text-slate-400 break-all">
                                {email.to_emails.join(', ')}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-300">Date:</span>
                              <p className="text-slate-400">
                                {format(new Date(email.sent_at), 'PPpp')}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-300">Labels:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {email.labels.map((label) => (
                                  <Badge key={label} variant="outline" className="text-xs">
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {email.body_plain && (
                            <div className="border-t border-slate-700/50 pt-4">
                              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                                {email.body_plain}
                              </pre>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {emails.length > emailsPerPage && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700/50">
            <div className="text-sm text-slate-400">
              Showing {((currentPage - 1) * emailsPerPage) + 1} to {Math.min(currentPage * emailsPerPage, totalEmails)} of {totalEmails} emails
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!hasPrevPage}
                className="text-slate-400 hover:text-white disabled:opacity-50"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!hasNextPage}
                className="text-slate-400 hover:text-white disabled:opacity-50"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ContactEmailHistory;