import React from 'react';
import { X, UserX } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const { userData, isImpersonating, stopImpersonating } = useUser();
  
  if (!isImpersonating || !userData) {
    return null;
  }
  
  const displayName = userData.full_name || 
    `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 
    userData.email;
  
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 dark:bg-amber-600 text-white shadow-lg">
      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <UserX className="h-4 w-4" />
            <span className="font-semibold">Impersonating:</span>
            <span>{displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={stopImpersonating}
            className="text-white hover:bg-amber-600 dark:hover:bg-amber-700 hover:text-white"
          >
            <X className="h-4 w-4 mr-1" />
            Stop Impersonation
          </Button>
        </div>
      </div>
    </div>
  );
}

