import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, User, Check, ChevronDown, X, UserCheck, UsersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwners } from '@/lib/hooks/useOwners';
import { useUser } from '@/lib/hooks/useUser';
import { cn } from '@/lib/utils';

interface OwnerFilterV3Props {
  selectedOwnerId?: string | null;
  onOwnerChange: (ownerId?: string | null) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  showQuickFilters?: boolean;
  defaultToCurrentUser?: boolean;
}

export function OwnerFilterV3({ 
  selectedOwnerId, 
  onOwnerChange, 
  placeholder = "Filter by owner",
  className = "",
  compact = false,
  showQuickFilters = true,
  defaultToCurrentUser = true
}: OwnerFilterV3Props) {
  const { owners, isLoading } = useOwners();
  const { userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isInitialized = useRef(false);

  // Initialize default owner on first mount only
  useEffect(() => {
    // Only initialize if we haven't already and we have user data
    if (!isInitialized.current && defaultToCurrentUser && userData?.id) {
      // Check if selectedOwnerId is undefined (meaning parent hasn't set a value yet)
      if (selectedOwnerId === undefined) {
        isInitialized.current = true;
        console.log('[OwnerFilterV3] Initializing to My Items:', userData.id);
        onOwnerChange(userData.id);
      } else {
        // Parent has already set a value, mark as initialized
        isInitialized.current = true;
      }
    }
  }, [userData?.id, defaultToCurrentUser, selectedOwnerId, onOwnerChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        isOpen &&
        buttonRef.current && 
        !buttonRef.current.contains(target) &&
        dropdownRef.current && 
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input and calculate position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    }
  }, [isOpen]);

  const getOwnerDisplayName = (owner: any) => {
    if (owner.full_name) return owner.full_name;
    if (owner.first_name || owner.last_name) {
      return `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
    }
    return owner.email || 'Unknown';
  };

  const getOwnerInitials = (owner: any) => {
    const name = getOwnerDisplayName(owner);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Filter owners based on search term
  const filteredOwners = owners.filter(owner => {
    if (!searchTerm) return true;
    const displayName = getOwnerDisplayName(owner).toLowerCase();
    const email = owner.email?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return displayName.includes(search) || email.includes(search);
  });

  // Get current selection display
  const getCurrentSelection = () => {
    // If we're waiting for initial user data and defaultToCurrentUser is true,
    // show "My Items" to prevent flicker
    if (selectedOwnerId === undefined && defaultToCurrentUser && !isInitialized.current) {
      return { 
        label: 'My Items', 
        icon: <UserCheck className="w-3.5 h-3.5" />,
        color: 'text-violet-400'
      };
    }
    
    // Explicitly check for null or undefined for "All Items"
    if (selectedOwnerId === null || selectedOwnerId === undefined) {
      return { 
        label: 'All Items', 
        icon: <UsersIcon className="w-3.5 h-3.5" />,
        color: 'text-blue-400'
      };
    }
    
    if (selectedOwnerId === userData?.id) {
      return { 
        label: 'My Items', 
        icon: <UserCheck className="w-3.5 h-3.5" />,
        color: 'text-violet-400'
      };
    }
    
    const selectedOwner = owners.find(o => o.id === selectedOwnerId);
    if (selectedOwner) {
      return {
        label: getOwnerDisplayName(selectedOwner),
        icon: (
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-white">
              {getOwnerInitials(selectedOwner)}
            </span>
          </div>
        ),
        color: 'text-gray-200'
      };
    }
    
    return { 
      label: 'Unknown', 
      icon: <User className="w-3.5 h-3.5" />,
      color: 'text-gray-400'
    };
  };

  const currentSelection = getCurrentSelection();

  const handleOptionSelect = (ownerId: string | null | undefined) => {
    console.log('[OwnerFilterV3] Selecting:', ownerId);
    onOwnerChange(ownerId);
    setIsOpen(false);
    setSearchTerm('');
  };

  if (isLoading) {
    return (
      <div className={cn("relative", className)}>
        <div className={cn(
          "flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-md animate-pulse",
          compact ? "px-2 py-1 text-xs h-8" : "px-3 py-1.5 text-sm h-10"
        )}>
          <div className="w-3.5 h-3.5 bg-gray-600 rounded" />
          <div className="w-16 h-3 bg-gray-600 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      {/* Main Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full gap-2",
          "bg-gray-800/50 hover:bg-gray-800/70",
          "border border-gray-700 hover:border-gray-600",
          "rounded-md transition-all duration-150",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50",
          isOpen && "ring-2 ring-violet-500/40 border-violet-500/50 bg-gray-800/70",
          compact ? "px-2.5 py-1.5 text-xs h-8" : "px-3 py-2 text-sm h-10"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("flex-shrink-0", currentSelection.color)}>
            {currentSelection.icon}
          </span>
          <span className={cn("truncate font-medium", currentSelection.color)}>
            {currentSelection.label}
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {(selectedOwnerId !== null && selectedOwnerId !== undefined) && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleOptionSelect(null);
              }}
              className="p-0.5 hover:bg-gray-700/50 rounded transition-colors cursor-pointer"
              title="Clear filter"
            >
              <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
            </div>
          )}
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-gray-500 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </button>

      {/* Quick Filter Pills (Optional) */}
      {showQuickFilters && !isOpen && (
        <div className="absolute -bottom-7 left-0 flex gap-1 z-10">
          <button
            onClick={() => handleOptionSelect(userData?.id)}
            className={cn(
              "px-2 py-0.5 text-xs rounded-full transition-all",
              // Highlight My Items if selected OR if we're in initial state with defaultToCurrentUser
              (selectedOwnerId === userData?.id || (selectedOwnerId === undefined && defaultToCurrentUser && !isInitialized.current))
                ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 border border-gray-700/30"
            )}
          >
            My Items
          </button>
          <button
            onClick={() => handleOptionSelect(null)}
            className={cn(
              "px-2 py-0.5 text-xs rounded-full transition-all",
              // Only highlight All if explicitly selected (null), not during initial undefined state with defaultToCurrentUser
              (selectedOwnerId === null || (selectedOwnerId === undefined && !defaultToCurrentUser))
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 border border-gray-700/30"
            )}
          >
            All
          </button>
        </div>
      )}

      {/* Dropdown Menu - Rendered via Portal */}
      {isOpen && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "fixed",
                "min-w-[200px] max-w-[280px]",
                "bg-gray-900 backdrop-blur-xl",
                "border border-gray-700 rounded-lg shadow-2xl",
                "overflow-hidden",
                "z-[99999]"
              )}
              style={{ 
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${Math.max(dropdownPosition.width, 200)}px`,
                zIndex: 99999
              }}
            >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-800">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search owners..."
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-gray-800/50 border border-gray-700",
                  "rounded-md text-xs text-white placeholder-gray-500",
                  "focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Quick Filters Section */}
            <div className="p-1 border-b border-gray-800">
              {/* All Items */}
              <button
                onClick={() => handleOptionSelect(null)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md",
                  "text-xs font-medium transition-colors",
                  // Don't highlight if we're in initial undefined state with defaultToCurrentUser
                  (selectedOwnerId === null || (selectedOwnerId === undefined && !defaultToCurrentUser))
                    ? "bg-blue-500/20 text-blue-400"
                    : "hover:bg-gray-800/50 text-gray-300"
                )}
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>All Items</span>
                {(selectedOwnerId === null || (selectedOwnerId === undefined && !defaultToCurrentUser)) && (
                  <Check className="w-3 h-3 ml-auto" />
                )}
              </button>

              {/* My Items */}
              {userData && (
                <button
                  onClick={() => handleOptionSelect(userData.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md",
                    "text-xs font-medium transition-colors",
                    // Highlight if selected OR if we're in initial state with defaultToCurrentUser
                    (selectedOwnerId === userData.id || (selectedOwnerId === undefined && defaultToCurrentUser && !isInitialized.current))
                      ? "bg-violet-500/20 text-violet-400"
                      : "hover:bg-gray-800/50 text-gray-300"
                  )}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>My Items</span>
                  {(selectedOwnerId === userData.id || (selectedOwnerId === undefined && defaultToCurrentUser && !isInitialized.current)) && (
                    <Check className="w-3 h-3 ml-auto" />
                  )}
                </button>
              )}
            </div>

            {/* Team Members List */}
            {filteredOwners.length > 0 && (
              <div className="max-h-48 overflow-y-auto p-1">
                <div className="px-2 py-1">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Team Members
                  </span>
                </div>
                {filteredOwners.map((owner) => {
                  const isSelected = selectedOwnerId === owner.id;
                  const isCurrentUser = owner.id === userData?.id;
                  
                  return (
                    <button
                      key={owner.id}
                      onClick={() => handleOptionSelect(owner.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md",
                        "text-xs transition-colors",
                        isSelected
                          ? "bg-violet-500/20 text-violet-400"
                          : "hover:bg-gray-800/50 text-gray-300"
                      )}
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-white">
                          {getOwnerInitials(owner)}
                        </span>
                      </div>
                      <span className="truncate flex-1 text-left">
                        {getOwnerDisplayName(owner)}
                        {isCurrentUser && (
                          <span className="text-gray-500 ml-1">(You)</span>
                        )}
                      </span>
                      {isSelected && (
                        <Check className="w-3 h-3 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* No Results */}
            {searchTerm && filteredOwners.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-gray-500">
                  No owners found matching "{searchTerm}"
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
}