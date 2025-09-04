import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ExecutionMonitorProps {
  executions: any[];
}

const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({ executions }) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [isLive, setIsLive] = useState(true);

  const filteredExecutions = executions.filter(exec => {
    if (filter === 'all') return true;
    return exec.execution_status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-[#37bd7e]" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-[#37bd7e]';
      case 'failed':
        return 'bg-red-400';
      case 'pending':
        return 'bg-yellow-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg">
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Execution Monitor
            {isLive && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-[#37bd7e] rounded-full animate-pulse" />
                <span className="text-xs text-[#37bd7e]">LIVE</span>
              </div>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800/50 rounded-lg p-1">
              {(['all', 'success', 'failed', 'pending'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    filter === status
                      ? 'bg-[#37bd7e] text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto scrollbar-none">
        {filteredExecutions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No executions to show</p>
            <p className="text-xs mt-1">Workflow executions will appear here</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredExecutions.slice(0, 10).map((exec, index) => (
              <motion.div
                key={exec.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <div className={`w-1 h-8 ${getStatusColor(exec.execution_status)} rounded`} />
                {getStatusIcon(exec.execution_status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {exec.rule_name || 'Workflow Execution'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {exec.executed_at 
                      ? formatDistanceToNow(new Date(exec.executed_at), { addSuffix: true })
                      : 'Just now'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    exec.execution_status === 'success'
                      ? 'bg-[#37bd7e]/10 text-[#37bd7e]'
                      : exec.execution_status === 'failed'
                      ? 'bg-red-400/10 text-red-400'
                      : exec.execution_status === 'pending'
                      ? 'bg-yellow-400/10 text-yellow-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {exec.execution_status}
                  </span>
                  {exec.execution_time && (
                    <p className="text-xs text-gray-500 mt-1">
                      {exec.execution_time}ms
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      
      {filteredExecutions.length > 10 && (
        <div className="p-3 border-t border-gray-800/50 text-center">
          <button className="text-xs text-[#37bd7e] hover:text-[#37bd7e]/80 transition-colors">
            View all {filteredExecutions.length} executions →
          </button>
        </div>
      )}
    </div>
  );
};

export default ExecutionMonitor;