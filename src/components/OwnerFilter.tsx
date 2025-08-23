import React from 'react';
import { Users, User, Filter, ChevronDown } from 'lucide-react';
import { useOwners } from '@/lib/hooks/useOwners';
import { useUser } from '@/lib/hooks/useUser';

interface OwnerFilterProps {
  selectedOwnerId?: string;
  onOwnerChange: (ownerId?: string) => void;
  placeholder?: string;
  className?: string;
}

export function OwnerFilter({ 
  selectedOwnerId, 
  onOwnerChange, 
  placeholder = "Filter by sales rep...",
  className = ""
}: OwnerFilterProps) {
  const { owners, isLoading } = useOwners();
  const { userData } = useUser();
  
  // Note: Default owner is now set in PipelineContext, not here
  // This prevents conflicts between multiple components trying to set the default

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

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-3 py-3 bg-gray-900/80 border border-gray-700 rounded-lg text-gray-400">
          <Users className="w-4 h-4" />
          <span>Loading sales reps...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedOwnerId || ''}
        onChange={(e) => onOwnerChange(e.target.value === '' ? undefined : e.target.value)}
        className="appearance-none w-full px-3 py-3 pl-10 pr-10 bg-gray-900/80 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 hover:bg-gray-800/70 transition-colors cursor-pointer"
      >
        {userData && (
          <option value={userData.id} className="bg-gray-800 text-white">
            👤 My Items Only
          </option>
        )}
        
        <option value="" className="bg-gray-800 text-white">
          📋 All Sales Representatives
        </option>
        
        {owners.length > 0 && (
          <option disabled className="bg-gray-700 text-gray-400 font-medium">
            ──────────────
          </option>
        )}
        
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id} className="bg-gray-800 text-white">
            {getOwnerDisplayName(owner)}
            {owner.stage && ` (${owner.stage})`}
          </option>
        ))}
      </select>
      
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <Users className="w-4 h-4 text-gray-400" />
      </div>
      
      {/* Selected owner indicator */}
      {selectedOwnerId && (
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
          {selectedOwnerId === userData?.id ? (
            <User className="w-4 h-4 text-violet-400" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white">
              {owners.find(o => o.id === selectedOwnerId) && 
                getOwnerInitials(owners.find(o => o.id === selectedOwnerId)!)
              }
            </div>
          )}
        </div>
      )}
      
      {/* Dropdown arrow */}
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
} 