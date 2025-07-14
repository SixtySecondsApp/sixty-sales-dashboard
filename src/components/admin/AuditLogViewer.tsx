import React from 'react';
import { useAuditLogs, type FieldHistoryEntry, type AuditHistoryEntry } from '@/lib/hooks/useAuditLogs';
import { format } from 'date-fns';
import { History, AlertCircle, Plus, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuditLogViewerProps {
  tableName: string;
  recordId: string;
  fieldName?: string;
  title?: string;
}

export function AuditLogViewer({ 
  tableName, 
  recordId, 
  fieldName, 
  title = 'Change History' 
}: AuditLogViewerProps) {
  const { isAdmin, getFieldHistory, getAuditHistory, loading, error } = useAuditLogs();
  const [fieldHistory, setFieldHistory] = React.useState<FieldHistoryEntry[]>([]);
  const [auditHistory, setAuditHistory] = React.useState<AuditHistoryEntry[]>([]);

  React.useEffect(() => {
    if (isAdmin && recordId) {
      loadHistory();
    }
  }, [isAdmin, recordId, fieldName]);

  const loadHistory = async () => {
    try {
      if (fieldName) {
        const data = await getFieldHistory(tableName, recordId, fieldName);
        setFieldHistory(data);
        setAuditHistory([]); // Clear audit history when showing field history
      } else {
        const data = await getAuditHistory(tableName, recordId);
        setAuditHistory(data);
        setFieldHistory([]); // Clear field history when showing audit history
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <Plus className="w-3 h-3" />;
      case 'UPDATE':
        return <Edit className="w-3 h-3" />;
      case 'DELETE':
        return <Trash2 className="w-3 h-3" />;
      default:
        return <History className="w-3 h-3" />;
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'UPDATE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const renderChangeValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">(empty)</span>;
    }
    if (typeof value === 'object') {
      return <span className="text-xs text-gray-400">{JSON.stringify(value)}</span>;
    }
    return <span>{String(value)}</span>;
  };

  if (!isAdmin) {
    return null; // Don't show anything for non-admins
  }

  const hasData = fieldHistory.length > 0 || auditHistory.length > 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading history...</div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to load history</span>
        </div>
      ) : !hasData ? (
        <div className="text-sm text-gray-400">No history available</div>
      ) : (
        <div className="space-y-3">
          {/* Render Field History (for specific field changes) */}
          {fieldHistory.map((entry, idx) => (
            <div key={`field-${idx}`} className="text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {entry.old_value && (
                    <>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                        {entry.old_value}
                      </Badge>
                      <span className="text-gray-500">→</span>
                    </>
                  )}
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    {entry.new_value || '(empty)'}
                  </Badge>
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(entry.changed_at), 'MMM dd, HH:mm')}
                </span>
              </div>
            </div>
          ))}

          {/* Render Full Audit History (for all changes to the record) */}
          {auditHistory.map((entry, idx) => (
            <div key={`audit-${idx}`} className="border border-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${getActionBadgeColor(entry.action)}`}>
                    {getActionIcon(entry.action)}
                    <span className="ml-1">{entry.action}</span>
                  </Badge>
                  <span className="text-xs text-gray-400">
                    by {entry.changed_by || 'System'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(entry.changed_at), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
              
              {entry.changed_fields && entry.changed_fields.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium">
                    Changed fields: {entry.changed_fields.join(', ')}
                  </div>
                  
                  {entry.action === 'UPDATE' && entry.old_value && entry.new_value && (
                    <div className="space-y-1">
                      {entry.changed_fields.map((field) => {
                        const oldVal = entry.old_value?.[field];
                        const newVal = entry.new_value?.[field];
                        if (oldVal !== newVal) {
                          return (
                            <div key={field} className="text-xs">
                              <span className="text-gray-400">{field}:</span>
                              <div className="flex items-center gap-2 ml-2">
                                <div className="text-red-400">
                                  {renderChangeValue(oldVal)}
                                </div>
                                <span className="text-gray-500">→</span>
                                <div className="text-green-400">
                                  {renderChangeValue(newVal)}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                  
                  {entry.action === 'INSERT' && entry.new_value && (
                    <div className="text-xs">
                      <span className="text-gray-400">Created with:</span>
                      <div className="ml-2 text-green-400">
                        {renderChangeValue(entry.new_value)}
                      </div>
                    </div>
                  )}
                  
                  {entry.action === 'DELETE' && entry.old_value && (
                    <div className="text-xs">
                      <span className="text-gray-400">Deleted data:</span>
                      <div className="ml-2 text-red-400">
                        {renderChangeValue(entry.old_value)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Example usage components:

// For specific field history
export function MeetingTypeHistory({ activityId }: { activityId: string }) {
  return (
    <AuditLogViewer
      tableName="activities"
      recordId={activityId}
      fieldName="details"
      title="Meeting Type History"
    />
  );
}

// For full audit history (all changes to a record)
export function FullAuditHistory({ 
  tableName, 
  recordId, 
  title = "Full Change History" 
}: { 
  tableName: string; 
  recordId: string; 
  title?: string; 
}) {
  return (
    <AuditLogViewer
      tableName={tableName}
      recordId={recordId}
      title={title}
      // No fieldName provided = shows full audit history
    />
  );
}