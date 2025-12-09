/**
 * SlackUserMapping Component
 *
 * A table component for mapping Slack users to Sixty users.
 * Allows admins to link Slack accounts with Sixty accounts for @mentions and DMs.
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import {
  useSlackUserMappings,
  useUpdateUserMapping,
  type SlackUserMapping as SlackUserMappingType,
} from '@/lib/hooks/useSlackSettings';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers';

interface SlackUserMappingProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function SlackUserMapping({ onRefresh, isRefreshing }: SlackUserMappingProps) {
  const { data: mappings, isLoading: mappingsLoading } = useSlackUserMappings();
  const { data: orgMembers, isLoading: membersLoading } = useOrgMembers();
  const updateMapping = useUpdateUserMapping();

  const isLoading = mappingsLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleMappingChange = (slackUserId: string, sixtyUserId: string | null) => {
    updateMapping.mutate({ slackUserId, sixtyUserId });
  };

  const getStatusBadge = (mapping: SlackUserMappingType) => {
    if (mapping.sixty_user_id) {
      // Check if it was auto-matched by email
      const sixtyUser = orgMembers?.find((m) => m.user_id === mapping.sixty_user_id);
      const isAutoMatched = sixtyUser?.email === mapping.slack_email;

      return (
        <Badge variant="default" className="bg-green-600">
          <Check className="h-3 w-3 mr-1" />
          {isAutoMatched ? 'Auto-matched' : 'Mapped'}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-600">
        <AlertCircle className="h-3 w-3 mr-1" />
        Unmapped
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Map Slack users to Sixty users for @mentions and DMs
        </p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Slack Users
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slack User</TableHead>
              <TableHead>Sixty User</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!mappings || mappings.length === 0) ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No Slack users found. Users will appear here after they interact with the Sixty bot.
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">@{mapping.slack_username || mapping.slack_user_id}</span>
                      {mapping.slack_email && (
                        <span className="text-xs text-muted-foreground">{mapping.slack_email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping.sixty_user_id || 'unmapped'}
                      onValueChange={(value) =>
                        handleMappingChange(mapping.slack_user_id, value === 'unmapped' ? null : value)
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">
                          <span className="text-muted-foreground">Not mapped</span>
                        </SelectItem>
                        {orgMembers?.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            <div className="flex flex-col">
                              <span>{member.name || member.email}</span>
                              {member.name && (
                                <span className="text-xs text-muted-foreground">{member.email}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{getStatusBadge(mapping)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {mappings && mappings.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">
              <Check className="h-3 w-3 mr-1" />
              Mapped
            </Badge>
            <span>{mappings.filter((m) => m.sixty_user_id).length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unmapped
            </Badge>
            <span>{mappings.filter((m) => !m.sixty_user_id).length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SlackUserMapping;
