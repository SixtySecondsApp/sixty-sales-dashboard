import React, { useState, useRef, useEffect } from 'react';
import { Users, User, Check, ChevronDown, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwners } from '@/lib/hooks/useOwners';
import { useUser } from '@/lib/hooks/useUser';

interface OwnerFilterProps {
  selectedOwnerId?: string;
  onOwnerChange: (ownerId?: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

type FilterOption = 'my-items' | 'all' | 'team' | string;

export function OwnerFilter({ 
  selectedOwnerId, 
  onOwnerChange, 
  placeholder = "Filter by owner...",
  className = "",
  compact = false
}: OwnerFilterProps) {
  const { owners, isLoading } = useOwners();
  const { userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isTyping = useRef(false);
  
  // Set default to current user on component mount if no owner is selected
  React.useEffect(() => {
    if (userData?.id && selectedOwnerId === undefined) {
      onOwnerChange(userData.id);
    }
  }, [userData?.id, selectedOwnerId, onOwnerChange]);

  // Close dropdown when clicking outside - disabled for now to fix search input
  // useEffect(() => {
  //   function handleClickOutside(event: MouseEvent) {
  //     if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
  //       // Only close if the dropdown is open and user is not actively typing
  //       if (isOpen && !isTyping.current) {
  //         setIsOpen(false);
  //         setSearchTerm('');
  //       }
  //     }
  //   }

  //   if (isOpen) {
  //     document.addEventListener('mousedown', handleClickOutside);
  //     return () => document.removeEventListener('mousedown', handleClickOutside);
  //   }
  // }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const getOwnerDisplayName = (owner: any) => {
    if (owner.full_name) return owner.full_name;
    if (owner.first_name || owner.last_name) {
      return `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
    }
    return owner.email;
  };

  const getOwnerInitials = (owner: any) => {
    if (owner.first_name && owner.last_name) {
      return `${owner.first_name[0]}${owner.last_name[0]}`.toUpperCase();
    }
    if (owner.first_name) return owner.first_name[0].toUpperCase();
    if (owner.last_name) return owner.last_name[0].toUpperCase();
    return owner.email[0].toUpperCase();
  };

  // Filter owners based on search term
  const filteredOwners = owners.filter(owner => {
    if (!searchTerm) return true;
    const displayName = getOwnerDisplayName(owner).toLowerCase();
    return displayName.includes(searchTerm.toLowerCase());
  });

  // Get current selection display
  const getCurrentSelection = () => {
    if (!selectedOwnerId) {
      return { label: 'All Items', icon: <Users className="w-4 h-4" />, isDefault: false };
    }
    
    if (selectedOwnerId === userData?.id) {
      return { label: 'My Items', icon: <User className="w-4 h-4 text-violet-400" />, isDefault: true };
    }
    
    const selectedOwner = owners.find(o => o.id === selectedOwnerId);
    if (selectedOwner) {
      return {
        label: getOwnerDisplayName(selectedOwner),
        icon: (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white">
            {getOwnerInitials(selectedOwner)}
          </div>
        ),
        isDefault: false
      };
    }
    
    return { label: 'Unknown Owner', icon: <Users className="w-4 h-4" />, isDefault: false };
  };

  const currentSelection = getCurrentSelection();

  const handleOptionSelect = (ownerId: string | undefined) => {
    onOwnerChange(ownerId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOwnerChange(undefined);
  };

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className={`flex items-center gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} bg-gray-900/40 border border-gray-700/50 rounded-lg text-gray-400`}>
          <Users className="w-4 h-4 animate-pulse" />
          <span className={compact ? 'text-sm' : ''}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between w-full gap-2 
          ${compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'} 
          bg-gray-900/40 hover:bg-gray-900/60 
          border border-gray-700/50 hover:border-gray-600/50 
          rounded-lg transition-all duration-200 
          focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
          ${isOpen ? 'ring-2 ring-violet-500/50 border-violet-500/50' : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {currentSelection.icon}
          <span className={`truncate ${currentSelection.isDefault ? 'text-violet-300 font-medium' : 'text-gray-200'}`}>
            {currentSelection.label}
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedOwnerId && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              title="Clear filter"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-lg shadow-2xl max-h-80 overflow-hidden"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-700/50 flex items-center gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search owners..."
                className="flex-1 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                autoComplete="off"
              />
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-white"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="py-1">
              {/* My Items */}
              {userData && (
                <button
                  onClick={() => handleOptionSelect(userData.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors
                    ${selectedOwnerId === userData.id ? 'bg-violet-900/30 text-violet-300' : 'text-gray-200'}
                  `}
                >
                  <User className="w-4 h-4 text-violet-400" />
                  <span className="font-medium">My Items</span>
                  {selectedOwnerId === userData.id && (
                    <Check className="w-4 h-4 ml-auto text-violet-400" />
                  )}
                </button>
              )}
              
              {/* All Items */}
              <button
                onClick={() => handleOptionSelect(undefined)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors
                  ${!selectedOwnerId ? 'bg-blue-900/30 text-blue-300' : 'text-gray-200'}
                `}
              >
                <Users className="w-4 h-4 text-blue-400" />
                <span>All Items</span>
                {!selectedOwnerId && (
                  <Check className="w-4 h-4 ml-auto text-blue-400" />
                )}
              </button>
            </div>

            {/* Team Members */}
            {filteredOwners.length > 0 && (
              <>
                <div className="px-3 py-1 border-t border-gray-700/30">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Team Members</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredOwners.map((owner) => {
                    const isSelected = selectedOwnerId === owner.id;
                    return (
                      <button
                        key={owner.id}
                        onClick={() => handleOptionSelect(owner.id)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors
                          ${isSelected ? 'bg-green-900/30 text-green-300' : 'text-gray-200'}
                        `}
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white">
                          {getOwnerInitials(owner)}
                        </div>
                        <span className="truncate">{getOwnerDisplayName(owner)}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 ml-auto text-green-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* No Results */}
            {searchTerm && filteredOwners.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                No owners found matching "{searchTerm}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 