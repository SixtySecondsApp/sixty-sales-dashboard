import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Users, 
  Mail, 
  Phone, 
  Building2, 
  Plus, 
  X,
  CheckCircle,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { useContacts } from '@/lib/hooks/useContacts';
import { useUser } from '@/lib/hooks/useUser';
import { cn } from '@/lib/utils';
import logger from '@/lib/utils/logger';

interface ContactSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSelect: (contact: any) => void;
  prefilledEmail?: string;
  prefilledName?: string;
}

interface NewContactForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
}

export function ContactSearchModal({ 
  isOpen, 
  onClose, 
  onContactSelect, 
  prefilledEmail = '',
  prefilledName = ''
}: ContactSearchModalProps) {
  const { userData } = useUser();
  const { contacts, isLoading, searchContacts, createContact, findContactByEmail, fetchContacts } = useContacts();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  
  const [newContactForm, setNewContactForm] = useState<NewContactForm>({
    first_name: '',
    last_name: '',
    email: prefilledEmail,
    phone: '',
    company: '',
    job_title: ''
  });

  // Parse prefilled name into first/last name
  useEffect(() => {
    if (prefilledName && !newContactForm.first_name && !newContactForm.last_name) {
      const nameParts = prefilledName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ');
      
      setNewContactForm(prev => ({
        ...prev,
        first_name: firstName,
        last_name: lastName
      }));
    }
  }, [prefilledName, newContactForm.first_name, newContactForm.last_name]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(prefilledEmail || '');
      setShowCreateForm(false);
      setNewContactForm({
        first_name: prefilledName ? prefilledName.split(' ')[0] || '' : '',
        last_name: prefilledName ? prefilledName.split(' ').slice(1).join(' ') : '',
        email: prefilledEmail,
        phone: '',
        company: '',
        job_title: ''
      });
      
      // Fetch all contacts when modal opens
      fetchAllContacts();
      
      // Auto-search if we have a prefilled email
      if (prefilledEmail) {
        handleSearch(prefilledEmail);
      }
    }
  }, [isOpen, prefilledEmail, prefilledName]);
  
  // Fetch all contacts for initial display
  const fetchAllContacts = async () => {
    if (!isOpen) return;
    
    setIsSearching(true);
    try {
      // Fetch contacts without search term to get all
      logger.log('Calling searchContacts with empty string...');
      const results = await searchContacts('', true); // Explicitly pass includeCompany: true
      logger.log('Fetched all contacts:', results);
      logger.log('Results type:', typeof results);
      logger.log('Results is array:', Array.isArray(results));
      logger.log('Results length:', results?.length);
      setAllContacts(results || []);
      // If no search query, also set as search results
      if (!searchQuery.trim()) {
        setSearchResults(results || []);
      }
    } catch (error) {
      logger.error('Error fetching all contacts:', error);
      logger.error('Error stack:', error.stack);
      setAllContacts([]);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      // If query is empty, show all contacts
      setSearchResults(allContacts);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchContacts(query.trim(), true); // Explicitly pass includeCompany: true
      logger.log('Search results for', query, ':', results);
      setSearchResults(results || []);
    } catch (error) {
      logger.error('Search error:', error);
      toast.error('Failed to search contacts');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleContactSelect = (contact: any) => {
    onContactSelect(contact);
    onClose();
  };

  const handleCreateContact = async () => {
    if (!newContactForm.email || !newContactForm.first_name) {
      toast.error('Email and first name are required');
      return;
    }

    setIsCreating(true);
    try {
      // Check if contact already exists
      const existingContact = await findContactByEmail(newContactForm.email);
      if (existingContact) {
        toast.error('A contact with this email already exists');
        handleContactSelect(existingContact);
        return;
      }

      const contactData = {
        first_name: newContactForm.first_name,
        last_name: newContactForm.last_name,
        email: newContactForm.email,
        phone: newContactForm.phone || null,
        title: newContactForm.job_title || null,  // Map job_title to title for API
        owner_id: userData?.id || ''
        // Removed is_primary and company_name as they don't exist in the database
      };

      const newContact = await createContact(contactData);
      
      if (newContact) {
        toast.success('Contact created successfully!');
        handleContactSelect(newContact);
      }
    } catch (error) {
      logger.error('Error creating contact:', error);
      toast.error('Failed to create contact');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredResults = useMemo(() => {
    // Always use searchResults if we have a search query
    if (searchQuery.trim()) {
      return searchResults;
    }
    // Otherwise show all contacts
    return allContacts?.length > 0 ? allContacts : searchResults;
  }, [searchQuery, searchResults, allContacts]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Select Contact</h3>
                  <p className="text-sm text-gray-400">Search for existing contacts or create a new one</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex h-[600px]">
              {/* Search Panel */}
              <div className="flex-1 flex flex-col border-r border-gray-800/30">
                {/* Search Input */}
                <div className="p-4 border-b border-gray-800/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, or company..."
                      className="w-full pl-10 pr-10 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                    />
                    {isSearching && searchQuery && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Results */}
                <div className="flex-1 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="w-5 h-5 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
                        Searching contacts...
                      </div>
                    </div>
                  ) : filteredResults.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {filteredResults.map((contact) => (
                        <motion.button
                          key={contact.id}
                          whileHover={{ backgroundColor: 'rgba(75, 85, 99, 0.5)' }}
                          onClick={() => handleContactSelect(contact)}
                          className="w-full p-4 text-left rounded-xl transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-violet-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4 text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white truncate">
                                {contact.full_name || 
                                 `${contact.first_name || ''} ${contact.last_name || ''}`.trim() ||
                                 contact.email ||
                                 'Unknown Contact'}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-400 truncate">{contact.email}</span>
                              </div>
                              {(contact.company || contact.company_name || contact.companies?.name) && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Building2 className="w-3 h-3 text-gray-400" />
                                  <span className="text-sm text-gray-400 truncate">
                                    {contact.company || contact.company_name || contact.companies?.name}
                                  </span>
                                </div>
                              )}
                              {contact.phone && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  <span className="text-sm text-gray-400">{contact.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                      <h4 className="font-medium text-white mb-2">
                        {searchQuery ? 'No contacts found' : 'No contacts yet'}
                      </h4>
                      <p className="text-gray-400 text-sm mb-4">
                        {searchQuery 
                          ? `No contacts match "${searchQuery}". Try a different search or create a new contact.`
                          : 'Create your first contact to get started'
                        }
                      </p>
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Create New Contact
                      </button>
                    </div>
                  )}
                </div>

                {/* Create New Button */}
                {filteredResults.length > 0 && (
                  <div className="p-4 border-t border-gray-800/30">
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full px-4 py-3 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-xl hover:bg-violet-600/20 hover:border-violet-500/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Contact
                    </button>
                  </div>
                )}
              </div>

              {/* Create Form Panel */}
              <AnimatePresence>
                {showCreateForm && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '50%', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col border-l border-gray-800/30 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-gray-800/30">
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-violet-400" />
                        Create New Contact
                      </h4>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="First Name *"
                            value={newContactForm.first_name}
                            onChange={(e) => setNewContactForm(prev => ({
                              ...prev,
                              first_name: e.target.value
                            }))}
                            className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Last Name"
                            value={newContactForm.last_name}
                            onChange={(e) => setNewContactForm(prev => ({
                              ...prev,
                              last_name: e.target.value
                            }))}
                            className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                          />
                        </div>

                        <input
                          type="email"
                          placeholder="Email Address *"
                          value={newContactForm.email}
                          onChange={(e) => setNewContactForm(prev => ({
                            ...prev,
                            email: e.target.value
                          }))}
                          className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                          required
                        />

                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={newContactForm.phone}
                          onChange={(e) => setNewContactForm(prev => ({
                            ...prev,
                            phone: e.target.value
                          }))}
                          className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />

                        <input
                          type="text"
                          placeholder="Company Name"
                          value={newContactForm.company}
                          onChange={(e) => setNewContactForm(prev => ({
                            ...prev,
                            company: e.target.value
                          }))}
                          className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />

                        <input
                          type="text"
                          placeholder="Job Title"
                          value={newContactForm.job_title}
                          onChange={(e) => setNewContactForm(prev => ({
                            ...prev,
                            job_title: e.target.value
                          }))}
                          className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />
                      </div>
                    </div>

                    <div className="p-4 border-t border-gray-800/30">
                      <button
                        onClick={handleCreateContact}
                        disabled={!newContactForm.email || !newContactForm.first_name || isCreating}
                        className="w-full px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        {isCreating ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Create & Select Contact
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}