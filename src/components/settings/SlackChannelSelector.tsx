/**
 * SlackChannelSelector Component
 *
 * A dropdown component for selecting Slack channels.
 * Fetches available channels from the Slack API and allows users to select one.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSlackChannels } from '@/lib/hooks/useSlackSettings';
import { Loader2, Hash, Lock, AlertCircle } from 'lucide-react';

interface SlackChannelSelectorProps {
  value: string | null;
  onChange: (channelId: string, channelName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SlackChannelSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select a channel',
}: SlackChannelSelectorProps) {
  const { data: channels, isLoading, error, refetch } = useSlackChannels();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading channels...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive border border-destructive/50 rounded-md">
        <AlertCircle className="h-4 w-4" />
        Failed to load channels
        <button
          onClick={() => refetch()}
          className="ml-auto text-xs underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Filter to only show channels where bot is a member
  const availableChannels = channels?.filter((ch) => ch.is_member) || [];
  const unavailableChannels = channels?.filter((ch) => !ch.is_member) || [];

  return (
    <Select
      value={value || undefined}
      onValueChange={(channelId) => {
        const channel = channels?.find((ch) => ch.id === channelId);
        if (channel) {
          onChange(channel.id, channel.name);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {availableChannels.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Available Channels
            </div>
            {availableChannels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                <div className="flex items-center gap-2">
                  {channel.is_private ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{channel.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({channel.num_members} members)
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {unavailableChannels.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
              Invite Bot First
            </div>
            {unavailableChannels.slice(0, 5).map((channel) => (
              <SelectItem key={channel.id} value={channel.id} disabled>
                <div className="flex items-center gap-2 opacity-50">
                  {channel.is_private ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{channel.name}</span>
                </div>
              </SelectItem>
            ))}
            {unavailableChannels.length > 5 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                + {unavailableChannels.length - 5} more channels
              </div>
            )}
          </>
        )}

        {channels?.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No channels found. Make sure to invite the Sixty bot to at least one channel.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

export default SlackChannelSelector;
