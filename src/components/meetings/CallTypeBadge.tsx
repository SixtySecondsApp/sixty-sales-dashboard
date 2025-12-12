/**
 * Call Type Badge Component
 * Displays the classified call type with color and icon
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Search, 
  Presentation, 
  CheckCircle, 
  Users, 
  Users2, 
  Calendar, 
  Tag,
  Edit2,
  Loader2,
} from 'lucide-react';
import { CallTypeService, type OrgCallType } from '@/lib/services/callTypeService';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrgId } from '@/lib/contexts/OrgContext';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, any> = {
  phone: Phone,
  search: Search,
  presentation: Presentation,
  'check-circle': CheckCircle,
  users: Users,
  'users-2': Users2,
  calendar: Calendar,
  tag: Tag,
};

interface CallTypeBadgeProps {
  callTypeId: string | null;
  callTypeName?: string | null;
  callTypeConfidence?: number | null;
  callTypeReasoning?: string | null;
  meetingId: string;
  showEdit?: boolean;
  className?: string;
}

export function CallTypeBadge({
  callTypeId,
  callTypeName,
  callTypeConfidence,
  callTypeReasoning,
  meetingId,
  showEdit = false,
  className,
}: CallTypeBadgeProps) {
  const orgId = useOrgId();
  const { userData: user } = useUser();
  const [callType, setCallType] = useState<OrgCallType | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [availableCallTypes, setAvailableCallTypes] = useState<OrgCallType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (callTypeId && orgId) {
      loadCallType();
    }
  }, [callTypeId, orgId]);

  const loadCallType = async () => {
    if (!orgId || !callTypeId) return;

    try {
      const ct = await CallTypeService.getCallType(orgId, callTypeId);
      setCallType(ct);
    } catch (error) {
      console.error('Error loading call type:', error);
    }
  };

  const loadAvailableCallTypes = async () => {
    if (!orgId) return;

    try {
      const types = await CallTypeService.getActiveCallTypes(orgId);
      setAvailableCallTypes(types);
    } catch (error) {
      console.error('Error loading call types:', error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    loadAvailableCallTypes();
  };

  const handleSave = async (newCallTypeId: string | null) => {
    if (!user) return;

    try {
      setSaving(true);
      await CallTypeService.updateMeetingCallType(meetingId, newCallTypeId, user.id);
      toast.success('Call type updated');
      setIsEditing(false);
      
      // Reload call type if new one selected
      if (newCallTypeId) {
        const ct = await CallTypeService.getCallType(orgId!, newCallTypeId);
        setCallType(ct);
      } else {
        setCallType(null);
      }
    } catch (error) {
      console.error('Error updating call type:', error);
      toast.error('Failed to update call type');
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Select
          value={callTypeId || ''}
          onValueChange={(value) => handleSave(value || null)}
          disabled={saving}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select call type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {availableCallTypes.map((ct) => (
              <SelectItem key={ct.id} value={ct.id}>
                {ct.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(false)}
          disabled={saving}
        >
          <span className="text-xs">Cancel</span>
        </Button>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
      </div>
    );
  }

  const displayCallType = callType || (callTypeName ? { name: callTypeName, color: '#6366f1', icon: 'phone' } : null);

  if (!displayCallType) {
    if (showEdit) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleEdit}
          className={cn("text-xs", className)}
        >
          <Tag className="w-3 h-3 mr-1" />
          Classify
        </Button>
      );
    }
    return null;
  }

  const IconComponent = ICON_MAP[displayCallType.icon] || Phone;
  const confidencePercent = callTypeConfidence ? Math.round(callTypeConfidence * 100) : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        style={{
          backgroundColor: `${displayCallType.color}20`,
          color: displayCallType.color,
          borderColor: `${displayCallType.color}40`,
        }}
        className="flex items-center gap-1.5 text-xs border"
        title={callTypeReasoning || undefined}
      >
        <IconComponent className="w-3 h-3" />
        <span>{displayCallType.name}</span>
        {confidencePercent !== null && confidencePercent < 100 && (
          <span className="opacity-70">({confidencePercent}%)</span>
        )}
      </Badge>
      {showEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          className="h-5 w-5 p-0"
        >
          <Edit2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

