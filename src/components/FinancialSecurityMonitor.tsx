/**
 * FINANCIAL SECURITY MONITORING COMPONENT
 * 
 * Real-time monitoring and alerting component for financial data validation.
 * Provides administrators with visibility into financial data integrity issues.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  TrendingUp,
  Eye,
  Download,
  X,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FinancialLogger, getFinancialValidationHealth } from '@/lib/utils/financialValidation';

interface FinancialSecurityMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data?: any;
  source: string;
}

export function FinancialSecurityMonitor({ isOpen, onClose }: FinancialSecurityMonitorProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const refreshData = () => {
    setIsRefreshing(true);
    const currentLogs = FinancialLogger.getLogs();
    const currentHealth = getFinancialValidationHealth();
    
    setLogs(currentLogs);
    setHealth(currentHealth);
    
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const filteredLogs = logs.filter(log => 
    selectedSeverity === 'all' || log.severity === selectedSeverity
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'low':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return AlertCircle;
      case 'high':
        return AlertTriangle;
      case 'medium':
        return AlertTriangle;
      case 'low':
        return Info;
      default:
        return Info;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `financial-security-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearLogs = () => {
    FinancialLogger.clearLogs();
    setLogs([]);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Financial Security Monitor
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
          {/* Health Status */}
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-lg border ${getHealthStatusColor(health.status)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">System Health</span>
                </div>
                <div className="text-lg font-bold capitalize">{health.status}</div>
              </div>
              
              <div className="bg-gray-800/50 border border-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-gray-300">Total Logs</span>
                </div>
                <div className="text-lg font-bold text-white">{health.totalLogs}</div>
              </div>
              
              <div className="bg-gray-800/50 border border-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-gray-300">Critical Issues</span>
                </div>
                <div className="text-lg font-bold text-red-400">{health.severityCounts.critical}</div>
              </div>
              
              <div className="bg-gray-800/50 border border-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-gray-300">High Priority</span>
                </div>
                <div className="text-lg font-bold text-orange-400">{health.severityCounts.high}</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isRefreshing}
                className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
                className="bg-red-800/50 border-red-700/50 text-red-300 hover:bg-red-700/50"
              >
                Clear Logs
              </Button>
            </div>
          </div>

          {/* Logs */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300">
              Security Events ({filteredLogs.length})
            </h3>
            
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No financial security events to display
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.slice(0, 100).map((log, index) => {
                  const SeverityIcon = getSeverityIcon(log.severity);
                  const isExpanded = expandedLog === `${log.timestamp}-${index}`;
                  
                  return (
                    <motion.div
                      key={`${log.timestamp}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`border rounded-lg p-3 ${getSeverityColor(log.severity)}`}
                    >
                      <div 
                        className="flex items-start gap-3 cursor-pointer"
                        onClick={() => setExpandedLog(isExpanded ? null : `${log.timestamp}-${index}`)}
                      >
                        <SeverityIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase">
                              {log.severity}
                            </span>
                            <span className="text-xs opacity-70">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          
                          <p className="text-sm mt-1">{log.message}</p>
                          
                          {log.data && (
                            <button className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                              {isExpanded ? 'Hide' : 'Show'} Details
                            </button>
                          )}
                        </div>
                        
                        <button className="p-1 hover:bg-white/10 rounded">
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && log.data && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 overflow-hidden"
                          >
                            <div className="bg-gray-800/50 rounded p-3">
                              <pre className="text-xs text-gray-300 overflow-x-auto">
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                
                {filteredLogs.length > 100 && (
                  <div className="text-center py-4 text-gray-500">
                    Showing first 100 entries. Export for full logs.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for easy integration into admin components
export function useFinancialSecurityMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  
  const openMonitor = () => setIsOpen(true);
  const closeMonitor = () => setIsOpen(false);
  
  const getQuickStatus = () => {
    const health = getFinancialValidationHealth();
    return health.status;
  };
  
  return {
    isOpen,
    openMonitor,
    closeMonitor,
    getQuickStatus,
    FinancialSecurityMonitor: () => (
      <FinancialSecurityMonitor isOpen={isOpen} onClose={closeMonitor} />
    )
  };
}