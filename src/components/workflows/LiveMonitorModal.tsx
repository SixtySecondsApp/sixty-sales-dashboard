import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Monitor,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  BarChart3,
  Filter,
  Search,
  RefreshCw,
  Bell,
  BellOff,
  Zap,
  Eye,
  Download,
  Settings,
  Users,
  Calendar,
  TrendingUp,
  AlertCircle as AlertIcon
} from 'lucide-react';
import { workflowExecutionService, type WorkflowExecution } from '@/lib/services/workflowExecutionService';
import { formatDistanceToNow } from 'date-fns';
import NodeExecutionModal from './NodeExecutionModal';

interface LiveMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId?: string | null;
  workflowName?: string;
}

interface MonitorStats {
  totalExecutions: number;
  runningExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  successRate: number;
}

interface JobQueueItem extends WorkflowExecution {
  position?: number;
  estimatedStartTime?: string;
}

const LiveMonitorModal: React.FC<LiveMonitorModalProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowName
}) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [filteredExecutions, setFilteredExecutions] = useState<WorkflowExecution[]>([]);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [stats, setStats] = useState<MonitorStats>({
    totalExecutions: 0,
    runningExecutions: 0,
    completedExecutions: 0,
    failedExecutions: 0,
    avgExecutionTime: 0,
    successRate: 0
  });
  const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio for alerts
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const createBeepSound = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      return () => {
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      };
    };
    
    alertSoundRef.current = { play: createBeepSound() } as any;
  }, []);

  // Load executions
  const loadExecutions = async () => {
    try {
      let allExecutions: WorkflowExecution[] = [];
      
      if (workflowId) {
        // Load executions for specific workflow only
        const dbExecutions = await workflowExecutionService.loadExecutionsFromDatabase(workflowId);
        
        // Also get any in-memory executions for this workflow
        const memoryExecutions = workflowExecutionService.getWorkflowExecutions(workflowId);
        
        // Combine and deduplicate (prefer memory version if exists)
        const executionMap = new Map<string, WorkflowExecution>();
        dbExecutions.forEach(exec => executionMap.set(exec.id, exec));
        memoryExecutions.forEach(exec => executionMap.set(exec.id, exec)); // Memory overwrites DB
        
        allExecutions = Array.from(executionMap.values());
      } else {
        // Load all executions from database if no specific workflow
        await workflowExecutionService.loadAllExecutionsFromDatabase();
        allExecutions = workflowExecutionService.getAllExecutions();
      }
      
      // Filter for production only (not test mode)
      allExecutions = allExecutions.filter(exec => !exec.isTestMode);
      
      // Sort by start time (most recent first)
      allExecutions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      
      setExecutions(allExecutions);
      calculateStats(allExecutions);
    } catch (error) {
    }
  };

  // Calculate monitoring stats
  const calculateStats = (executions: WorkflowExecution[]) => {
    const total = executions.length;
    const running = executions.filter(e => e.status === 'running').length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    
    // Calculate average execution time for completed jobs
    const completedWithTime = executions.filter(e => e.status === 'completed' && e.startedAt && e.completedAt);
    const avgTime = completedWithTime.length > 0 
      ? completedWithTime.reduce((sum, exec) => {
          const duration = new Date(exec.completedAt!).getTime() - new Date(exec.startedAt).getTime();
          return sum + duration;
        }, 0) / completedWithTime.length
      : 0;
    
    const successRate = total > 0 ? (completed / total) * 100 : 0;
    
    setStats({
      totalExecutions: total,
      runningExecutions: running,
      completedExecutions: completed,
      failedExecutions: failed,
      avgExecutionTime: avgTime,
      successRate
    });
    
    // Update job queue (running and pending jobs)
    const queueItems = executions
      .filter(e => e.status === 'running')
      .map((exec, index) => ({
        ...exec,
        position: index + 1,
        estimatedStartTime: exec.startedAt
      }));
    
    setJobQueue(queueItems);
  };

  // Filter executions
  useEffect(() => {
    let filtered = executions;
    
    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(exec => exec.status === selectedFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(exec => 
        exec.workflowName?.toLowerCase().includes(query) ||
        exec.id.toLowerCase().includes(query) ||
        exec.triggeredBy.toLowerCase().includes(query)
      );
    }
    
    setFilteredExecutions(filtered);
  }, [executions, selectedFilter, searchQuery]);

  // Auto-refresh effect
  useEffect(() => {
    if (isOpen && autoRefresh && isLiveMode) {
      loadExecutions(); // Initial load
      
      refreshIntervalRef.current = setInterval(() => {
        loadExecutions();
      }, refreshInterval);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isOpen, autoRefresh, isLiveMode, refreshInterval, workflowId]);

  // Alert for new failures
  useEffect(() => {
    if (alertsEnabled && stats.failedExecutions > 0) {
      const recentFailures = executions.filter(exec => 
        exec.status === 'failed' && 
        new Date().getTime() - new Date(exec.startedAt).getTime() < 60000 // Last minute
      );
      
      if (recentFailures.length > 0 && alertSoundRef.current?.play) {
        alertSoundRef.current.play();
      }
    }
  }, [stats.failedExecutions, alertsEnabled, executions]);

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/20' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/20' };
      case 'running':
        return { icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-400/20' };
      default:
        return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-400/20' };
    }
  };

  // Handle execution click
  const handleExecutionClick = (execution: WorkflowExecution) => {
    setSelectedExecution(execution);
    // You could open a detailed view or show execution details
  };

  // Handle node click in execution details
  const handleNodeClick = (node: any, execution: WorkflowExecution) => {
    const nodeExecution = execution.nodeExecutions.find(ne => ne.nodeId === node.id);
    setSelectedNode({ ...node, executionData: nodeExecution });
    setShowNodeModal(true);
  };

  // Export monitoring data
  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      workflowId,
      workflowName,
      stats,
      executions: filteredExecutions,
      jobQueue
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-monitor-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full h-full max-w-7xl max-h-[95vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-900 to-green-800 p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center relative">
                  <Monitor className="w-5 h-5 text-white" />
                  {isLiveMode && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">📡 Workflow Jobs Monitor</h2>
                  <p className="text-sm text-green-200">
                    {workflowId ? `${workflowName || 'Current Workflow'} - Production Jobs Only` : 'All Workflows - Production Jobs'}
                  </p>
                </div>
              </div>
              
              {/* Header Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={`p-2 rounded-lg transition-colors ${
                    alertsEnabled ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400'
                  }`}
                  title={alertsEnabled ? 'Disable alerts' : 'Enable alerts'}
                >
                  {alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`p-2 rounded-lg transition-colors ${
                    autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}
                  title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                >
                  <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                </button>
                
                <button
                  onClick={exportData}
                  className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                  title="Export data"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Dashboard */}
          <div className="bg-gray-800/50 p-4 border-b border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{stats.totalExecutions}</div>
                <div className="text-xs text-gray-400">Total Jobs</div>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.runningExecutions}</div>
                <div className="text-xs text-gray-400">Running</div>
              </div>
              <div className="bg-green-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.completedExecutions}</div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
              <div className="bg-red-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.failedExecutions}</div>
                <div className="text-xs text-gray-400">Failed</div>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {Math.round(stats.avgExecutionTime / 1000)}s
                </div>
                <div className="text-xs text-gray-400">Avg Time</div>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {Math.round(stats.successRate)}%
                </div>
                <div className="text-xs text-gray-400">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Controls and Filters */}
          <div className="bg-gray-800/30 p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              {/* Search and Filter */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search executions..."
                    className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value as any)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
                >
                  <option value="all">All Status</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Refresh Controls */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Refresh:</span>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  disabled={!autoRefresh}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-green-500 disabled:opacity-50"
                >
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Job Queue */}
            <div className="w-80 bg-gray-800/50 border-r border-gray-700 p-4 overflow-y-auto">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Live Job Queue ({jobQueue.length})
              </h3>
              
              {jobQueue.length === 0 ? (
                <div className="text-center py-8">
                  <PlayCircle className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                  <p className="text-gray-500 text-sm">No jobs currently running</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {jobQueue.map((job, index) => {
                    const statusInfo = getStatusInfo(job.status);
                    const Icon = statusInfo.icon;
                    
                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${statusInfo.bg} border-gray-600 hover:border-gray-500`}
                        onClick={() => handleExecutionClick(job)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${statusInfo.color}`} />
                          <span className="text-sm font-medium text-white truncate">
                            {job.workflowName || `Job ${job.id.slice(0, 8)}`}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Started {formatDistanceToNow(new Date(job.startedAt))} ago
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Position: #{job.position}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Panel - Execution History */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Execution History ({filteredExecutions.length})
                </h3>
                <button
                  onClick={loadExecutions}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {filteredExecutions.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-500">No executions found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchQuery ? 'Try adjusting your search' : 'Run some workflows to see executions here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredExecutions.map((execution) => {
                    const statusInfo = getStatusInfo(execution.status);
                    const Icon = statusInfo.icon;
                    
                    return (
                      <motion.div
                        key={execution.id}
                        layout
                        className={`p-4 rounded-lg border cursor-pointer transition-colors hover:border-gray-500 ${statusInfo.bg} border-gray-600`}
                        onClick={() => handleExecutionClick(execution)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${statusInfo.color}`} />
                            <span className="font-medium text-white">
                              {execution.workflowName || `Execution ${execution.id.slice(0, 8)}`}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(execution.startedAt))} ago
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-400">
                            Triggered by: {execution.triggeredBy}
                          </div>
                          {execution.completedAt && (
                            <div className="text-gray-500">
                              Duration: {Math.round(
                                (new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
                              )}s
                            </div>
                          )}
                        </div>
                        
                        {execution.error && (
                          <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2">
                            Error: {execution.error}
                          </div>
                        )}
                        
                        {execution.nodeExecutions.length > 0 && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-xs text-gray-500">Nodes:</span>
                            {execution.nodeExecutions.slice(0, 5).map((nodeExec, idx) => (
                              <div
                                key={nodeExec.nodeId}
                                className={`w-2 h-2 rounded-full ${
                                  nodeExec.status === 'completed' ? 'bg-green-400' :
                                  nodeExec.status === 'failed' ? 'bg-red-400' :
                                  nodeExec.status === 'running' ? 'bg-blue-400' :
                                  'bg-gray-400'
                                }`}
                                title={`${nodeExec.nodeType}: ${nodeExec.status}`}
                              />
                            ))}
                            {execution.nodeExecutions.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{execution.nodeExecutions.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Node Execution Modal */}
        {showNodeModal && selectedNode && (
          <NodeExecutionModal
            isOpen={showNodeModal}
            onClose={() => setShowNodeModal(false)}
            nodeData={selectedNode}
            executionData={selectedNode.executionData}
            nodeName={selectedNode.data?.label || selectedNode.id}
            nodeType={selectedNode.type || 'unknown'}
          />
        )}
      </div>
    </AnimatePresence>
  );
};

export default LiveMonitorModal;