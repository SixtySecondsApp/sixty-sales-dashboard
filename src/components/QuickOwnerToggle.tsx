import React from 'react';
import { Users, User, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '@/lib/hooks/useUser';

interface QuickOwnerToggleProps {
  selectedOwnerId?: string;
  onOwnerChange: (ownerId?: string) => void;
  className?: string;
}

export function QuickOwnerToggle({ 
  selectedOwnerId, 
  onOwnerChange,
  className = ""
}: QuickOwnerToggleProps) {
  const { userData } = useUser();
  
  // Set default to current user on component mount if no owner is selected
  React.useEffect(() => {
    if (userData?.id && selectedOwnerId === undefined) {
      onOwnerChange(userData.id);
    }
  }, [userData?.id, selectedOwnerId, onOwnerChange]);

  const isMyItems = selectedOwnerId === userData?.id;
  const isAllItems = !selectedOwnerId;

  const toggleOptions = [
    {
      id: userData?.id,
      label: 'My Items',
      icon: <User className="w-4 h-4" />,
      isActive: isMyItems,
      color: 'violet'
    },
    {
      id: undefined,
      label: 'All Items', 
      icon: <Users className="w-4 h-4" />,
      isActive: isAllItems,
      color: 'blue'
    }
  ];

  const handleToggle = (ownerId: string | undefined) => {
    onOwnerChange(ownerId);
  };

  return (
    <div className={`flex items-center bg-gray-900/40 border border-gray-700/50 rounded-lg p-1 ${className}`}>
      {toggleOptions.map((option, index) => {
        if (index === 0 && !userData) return null; // Skip "My Items" if no user data
        
        const isActive = option.isActive;
        
        return (
          <button
            key={option.label}
            onClick={() => handleToggle(option.id)}
            className={`
              relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
              ${isActive 
                ? `bg-${option.color}-600/20 text-${option.color}-300 shadow-sm` 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }
            `}
          >
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="activeToggle"
                className={`absolute inset-0 bg-${option.color}-600/20 rounded-md border border-${option.color}-500/30`}
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            
            <div className="relative z-10 flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
              {isActive && (
                <Check className="w-3 h-3" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}