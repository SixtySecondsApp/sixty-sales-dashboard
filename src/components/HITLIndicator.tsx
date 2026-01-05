/**
 * HITLIndicator Component
 *
 * Shows a notification indicator for pending Human-in-the-Loop (HITL) requests.
 * Displays a badge with the count and a dropdown with request details.
 */

import { useState } from 'react';
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  HelpCircle,
  List,
  Keyboard,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HITLResponseModal } from '@/components/platform/HITLResponseModal';
import {
  usePendingHITLRequests,
  type HITLRequestWithDetails,
} from '@/lib/hooks/useHITLRequests';

// =============================================================================
// Types
// =============================================================================

const REQUEST_TYPE_CONFIG = {
  confirmation: {
    label: 'Confirmation',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  question: {
    label: 'Question',
    icon: HelpCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  choice: {
    label: 'Choice',
    icon: List,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  input: {
    label: 'Input',
    icon: Keyboard,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
} as const;

// =============================================================================
// Helper Components
// =============================================================================

function TimeRemaining({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;

  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) {
    return <span className="text-red-500 text-[10px]">Expired</span>;
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return <span className="text-muted-foreground text-[10px]">{hours}h left</span>;
  }
  return <span className="text-amber-500 text-[10px]">{minutes}m left</span>;
}

function HITLRequestItem({
  request,
  onClick,
}: {
  request: HITLRequestWithDetails;
  onClick: () => void;
}) {
  const config = REQUEST_TYPE_CONFIG[request.request_type];
  const TypeIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className="w-full p-3 text-left hover:bg-muted/50 transition-colors rounded-lg group"
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', config.bgColor)}>
          <TypeIcon className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground truncate">
              {request.sequence_key || 'Workflow'}
            </span>
            <TimeRemaining expiresAt={request.expires_at} />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {request.prompt}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px] h-5">
              Step {request.step_index + 1}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {config.label}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>
    </button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function HITLIndicator() {
  const { data: pendingRequests, isLoading } = usePendingHITLRequests();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<HITLRequestWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const count = pendingRequests?.length || 0;

  // Don't render anything if no pending requests
  if (count === 0 && !isLoading) {
    return null;
  }

  const handleRequestClick = (request: HITLRequestWithDetails) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setIsOpen(false);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'relative p-2 rounded-xl transition-colors',
              'bg-slate-100 hover:bg-slate-50 dark:bg-gray-800/50 dark:hover:bg-gray-800/70',
              count > 0 && 'ring-2 ring-amber-400 dark:ring-amber-500'
            )}
            aria-label={`${count} pending HITL requests`}
          >
            <MessageSquare className="w-5 h-5 text-[#64748B] dark:text-gray-400" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {count > 9 ? '9+' : count}
                </span>
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="end"
          sideOffset={8}
        >
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm">Action Required</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {count} pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Workflows waiting for your response
            </p>
          </div>

          {count === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="p-2 space-y-1">
                {pendingRequests?.map((request) => (
                  <HITLRequestItem
                    key={request.id}
                    request={request}
                    onClick={() => handleRequestClick(request)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {count > 0 && (
            <div className="p-2 border-t bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a dedicated HITL page
                }}
              >
                View all in workflow center
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <HITLResponseModal
        request={selectedRequest}
        open={isModalOpen}
        onOpenChange={handleModalClose}
        onSuccess={() => {
          // Request list will auto-refresh via React Query
        }}
      />
    </>
  );
}

export default HITLIndicator;
