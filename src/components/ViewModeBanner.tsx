import React from 'react';
import { X } from 'lucide-react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ViewModeBanner() {
  const { isViewMode, viewedUser, exitViewMode } = useViewMode();
  const { isImpersonating } = useUser();
  
  if (!isViewMode || !viewedUser) {
    return null;
  }
  
  const displayName = viewedUser.full_name || 
    `${viewedUser.first_name || ''} ${viewedUser.last_name || ''}`.trim() || 
    viewedUser.email;
  
  // Position below ImpersonationBanner if it's shown (44px height)
  return (
    <div className={cn(
      "fixed left-0 right-0 z-[95] bg-amber-500 dark:bg-amber-600 text-white shadow-lg",
      isImpersonating ? "top-[44px]" : "top-0"
    )}>
      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">View Mode:</span>
            <span>Viewing data as {displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitViewMode}
            className="text-white hover:bg-amber-600 dark:hover:bg-amber-700 hover:text-white"
          >
            <X className="h-4 w-4 mr-1" />
            Exit View Mode
          </Button>
        </div>
      </div>
    </div>
  );
}