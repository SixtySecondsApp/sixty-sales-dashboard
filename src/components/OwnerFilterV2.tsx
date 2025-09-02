import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, User, Check, ChevronDown, X, UserCheck, UsersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwners } from '@/lib/hooks/useOwners';
import { useUser } from '@/lib/hooks/useUser';
import { cn } from '@/lib/utils';

interface OwnerFilterV2Props {
  selectedOwnerId?: string;
  onOwnerChange: (ownerId?: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  showQuickFilters?: boolean;
  defaultToCurrentUser?: boolean;
}

type QuickFilter = 'my-items' | 'all' | 'team';

export function OwnerFilterV2({ 
  selectedOwnerId, 
  onOwnerChange, 
  placeholder = "Filter by owner",
  className = "",
  compact = false,
  showQuickFilters = true,
  defaultToCurrentUser = true
}: OwnerFilterV2Props) {
  const { owners, isLoading } = useOwners();
  const { userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const hasInitialized = useRef(false);
  
  // Set default to current user only on initial mount if enabled
  useEffect(() => {
    console.log('[OwnerFilterV2] useEffect triggered', {
      defaultToCurrentUser,
      userData: userData?.id,
      hasInitialized: hasInitialized.current,
      selectedOwnerId
    });
    
    if (defaultToCurrentUser && userData?.id && !hasInitialized.current) {
      hasInitialized.current = true;
      if (selectedOwnerId === undefined) {
        console.log('[OwnerFilterV2] Setting default owner to:', userData.id);
        onOwnerChange(userData.id);
      }
    }
  }, [userData?.id, defaultToCurrentUser, selectedOwnerId, onOwnerChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        // Only close if the dropdown is open
        if (isOpen) {
          setIsOpen(false);
          setSearchTerm('');
        }
      }
    }

    if (isOpen) {
      // Use 'click' instead of 'mousedown' to allow button clicks to register
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens and calculate position
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
    if (!selectedOwnerId) {
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
  
  // Debug logging
  console.log('[OwnerFilterV2] Render:', {
    selectedOwnerId,
    currentSelection: currentSelection.label,
    isOpen,
    hasInitialized: hasInitialized.current
  });

  const handleOptionSelect = (ownerId: string | undefined) => {
    console.log('[OwnerFilterV2] handleOptionSelect called with:', ownerId);
    console.log('[OwnerFilterV2] Calling onOwnerChange with:', ownerId);
    onOwnerChange(ownerId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    switch (filter) {
      case 'my-items':
        handleOptionSelect(userData?.id);
        break;
      case 'all':
        handleOptionSelect(undefined);
        break;
      case 'team':
        // For team, we'll show all but exclude current user
        // This is a placeholder - you might want different logic
        setIsOpen(true);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className={cn("relative", className)}>
        <div className={cn(
          "flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-md animate-pulse",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        )}>
          <div className="w-3.5 h-3.5 bg-gray-600 rounded" />
          <div className="w-16 h-3 bg-gray-600 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={containerRef} style={{ zIndex: isOpen ? 99999 : 'auto' }}>
      {/* Main Trigger Button - Matching height of other filters */}
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
          {selectedOwnerId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOptionSelect(undefined);
              }}
              className="p-0.5 hover:bg-gray-700/50 rounded transition-colors"
              title="Clear filter"
            >
              <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
            </button>
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
            onClick={() => handleQuickFilter('my-items')}
            className={cn(
              "px-2 py-0.5 text-xs rounded-full transition-all",
              selectedOwnerId === userData?.id
                ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 border border-gray-700/30"
            )}
          >
            My Items
          </button>
          <button
            onClick={() => handleQuickFilter('all')}
            className={cn(
              "px-2 py-0.5 text-xs rounded-full transition-all",
              !selectedOwnerId
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 border border-gray-700/30"
            )}
          >
            All
          </button>
        </div>
      )}

      {/* Dropdown Menu rendered via Portal */}
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
                "z-[999999]"
              )}
              style={{ 
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                zIndex: 999999
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
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                autoComplete="off"
              />
            </div>

            {/* Quick Filters Section */}
            <div className="p-1 border-b border-gray-800">
              {/* My Items */}
              {userData && (
                <button
                  onClick={(e) => {
                    console.log('[OwnerFilterV2] My Items button clicked!');
                    e.stopPropagation();
                    handleOptionSelect(userData.id);
                  }}
                  onMouseDown={(e) => {
                    console.log('[OwnerFilterV2] My Items button mousedown!');
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md",
                    "text-xs font-medium transition-colors",
                    selectedOwnerId === userData.id
                      ? "bg-violet-500/20 text-violet-400"
                      : "hover:bg-gray-800/50 text-gray-300"
                  )}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>My Items</span>
                  {selectedOwnerId === userData.id && (
                    <Check className="w-3 h-3 ml-auto" />
                  )}
                </button>
              )}
              
              {/* All Items */}
              <button
                onClick={(e) => {
                  console.log('[OwnerFilterV2] All Items button clicked!');
                  e.stopPropagation();
                  handleOptionSelect(undefined);
                }}
                onMouseDown={(e) => {
                  console.log('[OwnerFilterV2] All Items button mousedown!');
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md",
                  "text-xs font-medium transition-colors",
                  !selectedOwnerId
                    ? "bg-blue-500/20 text-blue-400"
                    : "hover:bg-gray-800/50 text-gray-300"
                )}
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>All Items</span>
                {!selectedOwnerId && (
                  <Check className="w-3 h-3 ml-auto" />
                )}
              </button>
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