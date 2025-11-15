/**
 * Smart Search Component (⌘K)
 * Agent-like command palette with advanced natural language understanding
 * 
 * Features:
 * - Intelligent query parsing with intent detection (find, create, analyze, action)
 * - Multi-entity search (contacts, companies, deals, meetings)
 * - Smart relevance scoring and ranking
 * - Contextual quick actions (send email, schedule meeting, etc.)
 * - Query suggestions and auto-completion
 * - Natural language filters (value ranges, date ranges, status)
 * - Relationship-aware search
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import {
  Search,
  Mail,
  Sparkles,
  PlusCircle,
  Calendar,
  ArrowRight,
  X,
  User,
  Briefcase,
  Video,
  DollarSign,
  Building2,
  Phone,
  CheckSquare,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContacts } from '@/lib/hooks/useContacts';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import {
  parseQuery,
  generateQuerySuggestions,
  calculateRelevanceScore,
  extractQuickActions,
  type ParsedQuery
} from '@/lib/utils/searchIntelligence';

interface SmartSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCopilot?: () => void;
  onDraftEmail?: (contactId?: string, contactEmail?: string) => void;
  onAddContact?: () => void;
  onScheduleMeeting?: (contactId?: string) => void;
  onSelectContact?: (contactId: string) => void;
  onSelectMeeting?: (meetingId: string) => void;
  onSelectCompany?: (companyId: string) => void;
  onSelectDeal?: (dealId: string) => void;
  onAskCopilot?: (query: string) => void;
}

interface RecentContact {
  id: string;
  name: string;
  company: string;
  initials: string;
  color: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut: string;
  action: () => void;
}

interface Meeting {
  id: string;
  title: string;
  meeting_start: string;
  primary_contact_id: string | null;
  contact?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  meeting_attendees?: Array<{
    name: string;
    email: string;
  }>;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
}

interface Deal {
  id: string;
  name: string;
  value: number | null;
  company?: string;
  company_id?: string;
  deal_stages?: {
    name: string;
  };
  companies?: {
    name: string;
  };
}

interface SearchResult {
  id: string;
  type: 'contact' | 'meeting' | 'company' | 'deal';
  title: string;
  subtitle: string;
  icon: 'User' | 'Video' | 'Building2' | 'DollarSign';
  action: () => void;
  relevanceScore?: number;
  quickActions?: Array<{
    label: string;
    action: string;
    icon: string;
  }>;
  metadata?: any;
}

export const SmartSearch: React.FC<SmartSearchProps> = ({
  isOpen,
  onClose,
  onOpenCopilot,
  onDraftEmail,
  onAddContact,
  onScheduleMeeting,
  onSelectContact,
  onSelectMeeting,
  onSelectCompany,
  onSelectDeal,
  onAskCopilot
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [querySuggestions, setQuerySuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { userData } = useUser();
  
  // Fetch contacts for search
  const { contacts, isLoading: contactsLoading } = useContacts();

  // Parse query when it changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const parsed = parseQuery(searchQuery);
      setParsedQuery(parsed);
      const suggestions = generateQuerySuggestions(searchQuery, parsed.entities);
      setQuerySuggestions(suggestions);
    } else {
      setParsedQuery(null);
      setQuerySuggestions([]);
    }
  }, [searchQuery]);

  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'first_name', weight: 0.4 },
      { name: 'last_name', weight: 0.4 },
      { name: 'email', weight: 0.2 },
      { name: 'company', weight: 0.2 }
    ],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2
  };

  const fuse = useMemo(() => {
    if (!contacts || contacts.length === 0) return null;
    return new Fuse(contacts, fuseOptions);
  }, [contacts]);

  // Fetch meetings, companies, and deals when search is open
  useEffect(() => {
    if (!isOpen || !userData?.id) return;

    const fetchAllData = async () => {
      // Fetch meetings
      try {
        setIsLoadingMeetings(true);
        const { data: meetingsData, error: meetingsError } = await supabase
          .from('meetings')
          .select(`
            id,
            title,
            meeting_start,
            primary_contact_id,
            contact:contacts!primary_contact_id(
              id,
              first_name,
              last_name,
              email
            ),
            meeting_attendees(
              name,
              email
            )
          `)
          .eq('owner_user_id', userData.id)
          .order('meeting_start', { ascending: false })
          .limit(100);

        if (meetingsError) throw meetingsError;
        setMeetings((meetingsData || []) as Meeting[]);
      } catch (error) {
        console.error('Error fetching meetings:', error);
        setMeetings([]);
      } finally {
        setIsLoadingMeetings(false);
      }

      // Fetch companies
      try {
        setIsLoadingCompanies(true);
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('id, name, domain, industry')
          .eq('owner_id', userData.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (companiesError) throw companiesError;
        setCompanies((companiesData || []) as Company[]);
      } catch (error) {
        console.error('Error fetching companies:', error);
        setCompanies([]);
      } finally {
        setIsLoadingCompanies(false);
      }

      // Fetch deals
      try {
        setIsLoadingDeals(true);
        const { data: dealsData, error: dealsError } = await supabase
          .from('deals')
          .select(`
            id,
            name,
            value,
            company,
            company_id,
            deal_stages:deal_stages!deals_stage_id_fkey(
              name
            ),
            companies:companies!deals_company_id_fkey(
              name
            )
          `)
          .eq('owner_id', userData.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (dealsError) throw dealsError;
        setDeals((dealsData || []) as Deal[]);
      } catch (error) {
        console.error('Error fetching deals:', error);
        setDeals([]);
      } finally {
        setIsLoadingDeals(false);
      }
    };

    fetchAllData();
  }, [isOpen, userData?.id]);

  // Helper to check if query is meeting-specific
  const isMeetingQuery = (query: ParsedQuery | null): boolean => {
    if (!query) return false;
    return query.entities.includes('meeting') || 
           query.filters.contactName !== undefined ||
           query.intent === 'relationship';
  };

  // Configure Fuse.js for meeting search
  const meetingFuseOptions = {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'contact.first_name', weight: 0.3 },
      { name: 'contact.last_name', weight: 0.3 },
      { name: 'contact.email', weight: 0.2 },
      { name: 'meeting_attendees.name', weight: 0.2 }
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2
  };

  const meetingFuse = useMemo(() => {
    if (!meetings || meetings.length === 0) return null;
    return new Fuse(meetings, meetingFuseOptions);
  }, [meetings]);

  // Configure Fuse.js for company search
  const companyFuseOptions = {
    keys: [
      { name: 'name', weight: 0.6 },
      { name: 'domain', weight: 0.3 },
      { name: 'industry', weight: 0.1 }
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2
  };

  const companyFuse = useMemo(() => {
    if (!companies || companies.length === 0) return null;
    return new Fuse(companies, companyFuseOptions);
  }, [companies]);

  // Configure Fuse.js for deal search
  const dealFuseOptions = {
    keys: [
      { name: 'name', weight: 0.6 },
      { name: 'company', weight: 0.3 },
      { name: 'companies.name', weight: 0.3 },
      { name: 'deal_stages.name', weight: 0.1 }
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2
  };

  const dealFuse = useMemo(() => {
    if (!deals || deals.length === 0) return null;
    return new Fuse(deals, dealFuseOptions);
  }, [deals]);

  // Search results - search across all types with intelligent parsing
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !parsedQuery) return [];

    const results: SearchResult[] = [];

    // If it's a meeting query, search meetings only
    if (isMeetingQuery(parsedQuery)) {
      if (meetingFuse) {
        let searchTerm = searchQuery;
        if (parsedQuery.filters.contactName) {
          searchTerm = parsedQuery.filters.contactName;
        }

        const meetingResults = meetingFuse.search(searchTerm);
        const filteredResults = meetingResults
          .filter(result => {
            const meeting = result.item;
            // If contact name specified, filter by contact
            if (parsedQuery.filters.contactName) {
              const contactName = parsedQuery.filters.contactName.toLowerCase();
              const contactFullName = meeting.contact
                ? `${meeting.contact.first_name || ''} ${meeting.contact.last_name || ''}`.trim().toLowerCase()
                : '';
              const contactEmail = meeting.contact?.email?.toLowerCase() || '';
              const attendeeMatch = meeting.meeting_attendees?.some(
                attendee => attendee.name?.toLowerCase().includes(contactName) ||
                           attendee.email?.toLowerCase().includes(contactName)
              );

              return contactFullName.includes(contactName) ||
                     contactEmail.includes(contactName) ||
                     attendeeMatch ||
                     false;
            }
            return true;
          })
          .map(result => {
            const meeting = result.item;
            const contactName = meeting.contact
              ? `${meeting.contact.first_name || ''} ${meeting.contact.last_name || ''}`.trim() || meeting.contact.email
              : 'Unknown Contact';
            const meetingDate = meeting.meeting_start
              ? new Date(meeting.meeting_start).toLocaleDateString()
              : '';

            const relevanceScore = calculateRelevanceScore(meeting, parsedQuery, result.score || 0);
            const quickActions = extractQuickActions(parsedQuery, { type: 'meeting', ...meeting });

            return {
              id: meeting.id,
              type: 'meeting' as const,
              title: meeting.title || 'Untitled Meeting',
              subtitle: `${contactName}${meetingDate ? ` • ${meetingDate}` : ''}`,
              icon: 'Video' as const,
              relevanceScore,
              quickActions,
              metadata: meeting,
              action: () => {
                onSelectMeeting?.(meeting.id);
                onClose();
              }
            };
          })
          .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
          .slice(0, 5);

        results.push(...filteredResults);
      }
    } else {
      // Search across all types: contacts, companies, deals
      const searchTerm = searchQuery.trim();
      
      // Filter entities based on parsed query
      const entitiesToSearch = parsedQuery.entities.length > 0 
        ? parsedQuery.entities 
        : ['contact', 'company', 'deal'];
      
      // Search contacts
      if (entitiesToSearch.includes('contact') && fuse) {
        const contactResults = fuse.search(searchTerm);
        const contactSearchResults = contactResults.map(result => {
      const contact = result.item;
      const companyName = typeof contact.company === 'string' 
        ? contact.company 
        : (contact.company as any)?.name || contact.email || '';
          
          const relevanceScore = calculateRelevanceScore(contact, parsedQuery, result.score || 0);
          const quickActions = extractQuickActions(parsedQuery, { type: 'contact', ...contact });
      
      return {
        id: contact.id,
        type: 'contact' as const,
        title: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        subtitle: companyName,
            icon: 'User' as const,
            relevanceScore,
            quickActions,
            metadata: contact,
        action: () => {
          onSelectContact?.(contact.id);
          onClose();
        }
      };
    });
        results.push(...contactSearchResults);
      }

      // Search companies
      if (entitiesToSearch.includes('company') && companyFuse) {
        const companyResults = companyFuse.search(searchTerm);
        const companySearchResults = companyResults.map(result => {
          const company = result.item;
          const relevanceScore = calculateRelevanceScore(company, parsedQuery, result.score || 0);
          const quickActions = extractQuickActions(parsedQuery, { type: 'company', ...company });

          return {
            id: company.id,
            type: 'company' as const,
            title: company.name,
            subtitle: company.domain || company.industry || '',
            icon: 'Building2' as const,
            relevanceScore,
            quickActions,
            metadata: company,
            action: () => {
              onSelectCompany?.(company.id);
              onClose();
            }
          };
        });
        results.push(...companySearchResults);
      }

      // Search deals
      if (entitiesToSearch.includes('deal') && dealFuse) {
        const dealResults = dealFuse.search(searchTerm);
        const dealSearchResults = dealResults
          .filter(result => {
            const deal = result.item;
            // Apply value filters if specified
            if (parsedQuery.filters.valueRange) {
              if (!deal.value) return false;
              if (parsedQuery.filters.valueRange.min && deal.value < parsedQuery.filters.valueRange.min) {
                return false;
              }
              if (parsedQuery.filters.valueRange.max && deal.value > parsedQuery.filters.valueRange.max) {
                return false;
              }
            }
            return true;
          })
          .map(result => {
            const deal = result.item;
            const companyName = deal.companies?.name || deal.company || '';
            const value = deal.value ? `$${deal.value.toLocaleString()}` : '';
            const stage = deal.deal_stages?.name || '';
            
            const relevanceScore = calculateRelevanceScore(deal, parsedQuery, result.score || 0);
            const quickActions = extractQuickActions(parsedQuery, { type: 'deal', ...deal });

            return {
              id: deal.id,
              type: 'deal' as const,
              title: deal.name,
              subtitle: `${companyName}${value ? ` • ${value}` : ''}${stage ? ` • ${stage}` : ''}`,
              icon: 'DollarSign' as const,
              relevanceScore,
              quickActions,
              metadata: deal,
              action: () => {
                onSelectDeal?.(deal.id);
                onClose();
              }
            };
          });
        results.push(...dealSearchResults);
      }
    }

    // Sort results by relevance score (higher is better)
    return results
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 10); // Limit to 10 total results
  }, [searchQuery, parsedQuery, fuse, meetingFuse, companyFuse, dealFuse, onSelectContact, onSelectMeeting, onSelectCompany, onSelectDeal, onClose]);

  // Recent contacts (from actual data)
  const recentContacts = useMemo<RecentContact[]>(() => {
    if (!contacts || contacts.length === 0) return [];
    
    return contacts.slice(0, 5).map(contact => {
      const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
      const colors = [
        'from-blue-500 to-blue-600',
        'from-emerald-500 to-emerald-600',
        'from-purple-500 to-purple-600',
        'from-amber-500 to-amber-600',
        'from-pink-500 to-pink-600'
      ];
      
      // Handle company as string or Company object
      const companyName = typeof contact.company === 'string' 
        ? contact.company 
        : (contact.company as any)?.name || contact.email || '';
      
      return {
        id: contact.id,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        company: companyName,
        initials,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });
  }, [contacts]);

  const quickActions: QuickAction[] = [
    {
      id: 'draft-email',
      label: 'Draft follow-up email',
      icon: Mail,
      shortcut: 'E',
      action: () => {
        onDraftEmail?.();
        onClose();
      }
    },
    {
      id: 'open-copilot',
      label: 'Open Copilot',
      icon: Sparkles,
      shortcut: 'C',
      action: () => {
        onOpenCopilot?.();
        onClose();
      }
    },
    {
      id: 'add-contact',
      label: 'Add new contact',
      icon: PlusCircle,
      shortcut: 'N',
      action: () => {
        onAddContact?.();
        onClose();
      }
    },
    {
      id: 'schedule-meeting',
      label: 'Schedule meeting',
      icon: Calendar,
      shortcut: 'M',
      action: () => {
        onScheduleMeeting?.();
        onClose();
      }
    }
  ];

  const aiSuggestions = [
    {
      id: '1',
      query: 'What are my top priorities today?',
      action: () => {
        onAskCopilot?.('What are my top priorities today?');
        onClose();
      }
    },
    {
      id: '2',
      query: 'Show me at-risk deals',
      action: () => {
        onAskCopilot?.('Show me at-risk deals');
        onClose();
      }
    },
    {
      id: '3',
      query: 'Summarize my pipeline for this week',
      action: () => {
        onAskCopilot?.('Summarize my pipeline for this week');
        onClose();
      }
    }
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        setIsInputFocused(true);
      }, 100);
    } else {
      setSearchQuery('');
      setIsInputFocused(false);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't process shortcuts if input is focused and user is typing
      if (isInputFocused && isTyping) {
        return;
      }

      // Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // This will be handled by parent component
      }
      
      // Close on Escape (but not when typing)
      if (e.key === 'Escape' && isOpen && !isInputFocused) {
        onClose();
      }

      // Quick actions when palette is open and input not focused
      if (isOpen && !isTyping && !isInputFocused) {
        switch (e.key.toLowerCase()) {
          case 'e':
            e.preventDefault();
            onDraftEmail?.();
            onClose();
            break;
          case 'c':
            e.preventDefault();
            onOpenCopilot?.();
            onClose();
            break;
          case 'n':
            e.preventDefault();
            onAddContact?.();
            onClose();
            break;
          case 'm':
            e.preventDefault();
            onScheduleMeeting?.();
            onClose();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isTyping, isInputFocused, onDraftEmail, onOpenCopilot, onAddContact, onScheduleMeeting]);

  // Track typing state
  useEffect(() => {
    setIsTyping(searchQuery.length > 0);
  }, [searchQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-800/50">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search contacts, companies, deals, meetings, or ask Copilot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => {
              // Delay to allow click events to fire first
              setTimeout(() => setIsInputFocused(false), 200);
            }}
            onKeyDown={(e) => {
              // Stop propagation to prevent parent handlers
              e.stopPropagation();
              
              if (e.key === 'Enter' && searchQuery.trim()) {
                e.preventDefault();
                // If there are results, select the first one
                if (searchResults.length > 0) {
                  searchResults[0].action();
                } else if (querySuggestions.length > 0) {
                  // If there are suggestions, use the first one
                  setSearchQuery(querySuggestions[0]);
                } else {
                  // Otherwise, send to Copilot
                  onAskCopilot?.(searchQuery.trim());
                }
              } else if (e.key === 'Escape') {
                // Only close if input is empty
                if (!searchQuery.trim()) {
                  onClose();
                } else {
                  // Clear search instead
                  setSearchQuery('');
                }
              } else if (e.key === 'ArrowDown' && querySuggestions.length > 0 && !isInputFocused) {
                e.preventDefault();
                // Navigate suggestions (could be enhanced)
              }
            }}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 text-base focus:outline-none"
          />
          <kbd className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {/* Ask Copilot Option - Show when there's a query */}
          {searchQuery.trim() && (
            <div className="px-3 py-2">
              <button
                onClick={() => {
                  onAskCopilot?.(searchQuery.trim());
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-500/10 hover:border-blue-500/20 border border-transparent rounded-lg transition-all text-left group"
              >
                <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-300 group-hover:text-blue-400">
                    Ask Copilot: "{searchQuery}"
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Press Enter to ask Copilot</p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}

          {/* Query Suggestions - Show when typing or when results are limited */}
          {querySuggestions.length > 0 && searchQuery.trim().length > 2 && (
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                {searchResults.length === 0 ? 'Try These Searches' : 'Related Searches'}
              </p>
              <div className="space-y-1">
                {querySuggestions.slice(0, searchResults.length > 0 ? 3 : 6).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSearchQuery(suggestion)}
                    className="w-full flex items-start gap-3 px-3 py-2 hover:bg-blue-500/10 hover:border-blue-500/20 border border-transparent rounded-lg transition-all text-left group"
                  >
                    <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                    <span className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-800/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  {isMeetingQuery(parsedQuery) ? 'Meeting Matches' : 'Search Results'}
                </p>
                {parsedQuery && (
                  <div className="flex items-center gap-2">
                    {parsedQuery.filters.valueRange && (
                      <span className="text-xs text-gray-600">
                        {parsedQuery.filters.valueRange.min && `>$${parsedQuery.filters.valueRange.min.toLocaleString()}`}
                        {parsedQuery.filters.valueRange.max && ` <$${parsedQuery.filters.valueRange.max.toLocaleString()}`}
                      </span>
                    )}
                    {parsedQuery.filters.dateRange && (
                      <span className="text-xs text-gray-600">
                        {parsedQuery.filters.dateRange.from && '📅'}
                      </span>
                    )}
                    <span className="text-xs text-gray-600">
                      {parsedQuery.entities.length > 0 ? parsedQuery.entities.join(', ') : 'all'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {searchResults.map(result => {
                  let Icon = User;
                  if (result.icon === 'Video') Icon = Video;
                  else if (result.icon === 'Building2') Icon = Building2;
                  else if (result.icon === 'DollarSign') Icon = DollarSign;
                  
                  return (
                    <div
                      key={`${result.type}-${result.id}`}
                      className="group"
                    >
                  <button
                    onClick={result.action}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                  >
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate">{result.title}</p>
                      {result.subtitle && (
                            <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.relevanceScore && result.relevanceScore > 0.7 && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                            Best Match
                          </span>
                        )}
                      </button>
                      {/* Quick Actions */}
                      {result.quickActions && result.quickActions.length > 0 && (
                        <div className="flex items-center gap-1 px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {result.quickActions.slice(0, 3).map((action, idx) => {
                            let ActionIcon = Mail;
                            if (action.icon === 'Phone') ActionIcon = Phone;
                            else if (action.icon === 'Calendar') ActionIcon = Calendar;
                            else if (action.icon === 'CheckSquare') ActionIcon = CheckSquare;
                            else if (action.icon === 'Users') ActionIcon = Users;
                            
                            return (
                              <button
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Handle action based on type with context
                                  if (action.action === 'send-email') {
                                    if (result.type === 'contact' && result.metadata) {
                                      const email = result.metadata.email || '';
                                      onDraftEmail?.(result.id, email);
                                    } else {
                                      onDraftEmail?.();
                                    }
                                    onClose();
                                  } else if (action.action === 'schedule-meeting') {
                                    if (result.type === 'contact') {
                                      onScheduleMeeting?.(result.id);
                                    } else {
                                      onScheduleMeeting?.();
                                    }
                                    onClose();
                                  } else if (action.action === 'view-contacts' && result.type === 'company') {
                                    // Navigate to company contacts
                                    onSelectCompany?.(result.id);
                                    onClose();
                                  } else if (action.action === 'create-task' && result.type === 'meeting') {
                                    // Navigate to meeting to create task
                                    onSelectMeeting?.(result.id);
                                    onClose();
                                  } else {
                                    result.action();
                                  }
                                }}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800/30 rounded transition-colors"
                                title={action.label}
                              >
                                <ActionIcon className="w-3 h-3" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading indicator for meetings */}
          {isLoadingMeetings && searchQuery.trim() && isMeetingQuery(parsedQuery) && (
            <div className="px-3 py-2">
              <p className="text-xs text-gray-500">Loading meetings...</p>
            </div>
          )}

          {/* Quick Actions */}
          {!searchQuery.trim() && (
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={action.action}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300 flex-1">{action.label}</span>
                      <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700/50 rounded text-xs text-gray-500">
                        {action.shortcut}
                      </kbd>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Contacts */}
          {!searchQuery.trim() && (
            <div className="px-3 py-2 mt-2 border-t border-gray-800/50">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Contacts</p>
              <div className="space-y-1">
                {contactsLoading ? (
                  <p className="text-xs text-gray-500 px-3 py-2">Loading contacts...</p>
                ) : recentContacts.length > 0 ? (
                  recentContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => {
                        onSelectContact?.(contact.id);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 bg-gradient-to-br rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                          contact.color
                        )}
                      >
                        {contact.initials}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.company}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 px-3 py-2">No recent contacts</p>
                )}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <div className="px-3 py-2 mt-2 border-t border-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Ask Copilot
            </p>
            <div className="space-y-1">
              {aiSuggestions.map(suggestion => (
                <button
                  key={suggestion.id}
                  onClick={suggestion.action}
                  className="w-full flex items-start gap-3 px-3 py-2 hover:bg-blue-500/10 hover:border-blue-500/20 border border-transparent rounded-lg transition-all text-left"
                >
                  <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{suggestion.query}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

