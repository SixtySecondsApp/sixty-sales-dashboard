/**
 * Contact Auto-Complete Component
 * Provides intelligent contact search and selection for email composer
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Building2, Mail, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import logger from '@/lib/utils/logger';

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
}

interface ContactAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ContactAutoComplete({
  value,
  onChange,
  placeholder = 'To',
  className = ''
}: ContactAutoCompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch contacts based on search query
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts-autocomplete', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, email, company, title')
        .eq('owner_id', user.id)  // contacts table uses owner_id, not user_id
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) {
        logger.error('Error fetching contacts for autocomplete:', error);
        return [];
      }

      // Map full_name to name for the Contact interface
      return (data || []).map(contact => ({
        id: contact.id,
        name: contact.full_name,
        email: contact.email,
        company: contact.company,
        title: contact.title,
      })) as Contact[];
    },
    enabled: searchQuery.length >= 2,
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSearchQuery(newValue);
    setIsOpen(true);
    setSelectedIndex(0);
  };

  // Handle contact selection
  const handleSelectContact = (contact: Contact) => {
    const emailWithName = `${contact.name} <${contact.email}>`;
    onChange(emailWithName);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || contacts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % contacts.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + contacts.length) % contacts.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (contacts[selectedIndex]) {
          handleSelectContact(contacts[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse multiple email addresses
  const isMultipleEmails = value.includes(',') || value.includes(';');
  const displayValue = isMultipleEmails
    ? value.split(/[,;]/).pop()?.trim() || ''
    : value;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchQuery.length >= 2) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all',
            className
          )}
        />
        {value && (
          <button
            onClick={() => {
              onChange('');
              setSearchQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-700/50 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && contacts.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            <div className="p-2 border-b border-gray-700/50 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''} found
              </span>
            </div>

            <div className="py-1">
              {contacts.map((contact, index) => (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact)}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-700/50 transition-colors',
                    selectedIndex === index && 'bg-purple-500/20'
                  )}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-purple-400" />
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {contact.name}
                      </span>
                      {selectedIndex === index && (
                        <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.company && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">
                          {contact.title ? `${contact.title} at ${contact.company}` : contact.company}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="p-2 border-t border-gray-700/50 bg-gray-900/50">
              <p className="text-xs text-gray-500 text-center">
                Use ↑↓ to navigate • Enter to select • Esc to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Indicator */}
      {isLoading && searchQuery.length >= 2 && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
