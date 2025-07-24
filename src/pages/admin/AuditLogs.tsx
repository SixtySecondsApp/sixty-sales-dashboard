import React, { useState, useEffect, useCallback } from 'react';
import { useAuditLogs, formatAuditChanges, getChangeDescription } from '@/lib/hooks/useAuditLogs';
import { format } from 'date-fns';
import { 
  Search, 
  Calendar, 
  User, 
  Database, 
  Activity,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileText,
  Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AuditLog } from '@/lib/hooks/useAuditLogs';

interface AuditLogSearchParams {
  tableName?: string;
  recordId?: string;
  userId?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  startDate?: Date;
  endDate?: Date;
  changedField?: string;
}

export default function AuditLogs() {
  const { isAdmin, loading, error, getRecentAuditLogs, searchAuditLogs } = useAuditLogs();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const loadRecentLogs = async () => {
    try {
      const data = await getRecentAuditLogs(100);
      setLogs(data);
      setInitialLoadComplete(true);
    } catch (err) {
      // Error is already handled by the useAuditLogs hook's setError
      // The error state will be displayed in the UI automatically
      console.error('Failed to load audit logs:', err);
      setInitialLoadComplete(true);
    }
  };

  useEffect(() => {
    if (isAdmin && !initialLoadComplete) {
      loadRecentLogs();
    }
  }, [isAdmin, initialLoadComplete]);

  const handleSearch = async () => {
    try {
      const searchParams: AuditLogSearchParams = {};
      
      if (selectedTable) searchParams.tableName = selectedTable;
      if (selectedAction) searchParams.action = selectedAction as 'INSERT' | 'UPDATE' | 'DELETE';
      if (dateRange.start) searchParams.startDate = dateRange.start;
      if (dateRange.end) searchParams.endDate = dateRange.end;
      
      const data = await searchAuditLogs(searchParams);
      setLogs(data);
    } catch (err) {
      // Error is already handled by the useAuditLogs hook's setError
      // The error state will be displayed in the UI automatically
      console.error('Failed to search audit logs:', err);
    }
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
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

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Card className="bg-red-900/20 border-red-700">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-300">You must be an administrator to view audit logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-gray-400 mt-1">Track all data changes across the system</p>
        </div>
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          {logs.length} records
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Table</label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="">All Tables</option>
                <option value="activities">Activities</option>
                <option value="deals">Deals</option>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
                <option value="tasks">Tasks</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Action</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="">All Actions</option>
                <option value="INSERT">Insert</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
              <Input
                type="date"
                value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  start: e.target.value ? new Date(e.target.value) : null 
                }))}
                className="bg-gray-900/80 border-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
              <Input
                type="date"
                value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  end: e.target.value ? new Date(e.target.value) : null 
                }))}
                className="bg-gray-900/80 border-gray-700"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => {
                setSelectedTable('');
                setSelectedAction('');
                setDateRange({ start: null, end: null });
                loadRecentLogs();
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            Click on any entry to see detailed changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading audit logs...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">Error: {error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No audit logs found</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const changes = formatAuditChanges(log.old_data, log.new_data, log.changed_fields);
                
                return (
                  <div
                    key={log.id}
                    className="border border-gray-800 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleLogExpansion(log.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <Badge className={getActionBadgeColor(log.action)}>
                            {log.action}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Database className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300">{log.table_name}</span>
                        </div>
                        
                        <div className="text-sm text-gray-400">
                          {getChangeDescription(log.action, log.table_name, log.changed_fields)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(log.changed_at), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-800">
                        <div className="mt-3 space-y-3">
                          {/* Changed Fields */}
                          {changes.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">Changes:</h4>
                              <div className="space-y-2">
                                {changes.map((change, idx) => (
                                  <div key={idx} className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="text-gray-400">{change.field}:</div>
                                    <div className="text-red-400">
                                      {change.oldValue !== null ? JSON.stringify(change.oldValue) : '(empty)'}
                                    </div>
                                    <div className="text-green-400">
                                      {change.newValue !== null ? JSON.stringify(change.newValue) : '(empty)'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Metadata */}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>ID: {log.record_id}</span>
                            {log.user_id && <span>User: {log.user_id}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}