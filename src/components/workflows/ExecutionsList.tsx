import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PlayCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar,
  User
} from 'lucide-react';
import { workflowExecutionService, type WorkflowExecution } from '@/lib/services/workflowExecutionService';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExecutionsListProps {
  onExecutionSelect: (execution: WorkflowExecution) => void | Promise<void>;
  selectedExecution?: WorkflowExecution;
  workflowId?: string;
}

const ExecutionsList: React.FC<ExecutionsListProps> = ({ onExecutionSelect, selectedExecution, workflowId }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [activeMode, setActiveMode] = useState<'production' | 'test'>('production');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
  }, [activeMode, workflowId]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      // Load executions from database first to populate cache
      await workflowExecutionService.loadAllExecutionsFromDatabase();
      
      // Get all executions and filter by mode and workflowId
      const allExecutions = workflowExecutionService.getAllExecutions();
      const filtered = allExecutions.filter(exec => {
        const matchesMode = activeMode === 'test' ? exec.isTestMode : !exec.isTestMode;
        const matchesWorkflow = workflowId ? exec.workflowId === workflowId : true;
        return matchesMode && matchesWorkflow;
      });
      
      // Sort by most recent first
      const sorted = filtered.sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      
      setExecutions(sorted);
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (execution: WorkflowExecution) => {
    const status = execution.status;
    
    // Check for execution tracking issues
    const hasTrackingIssues = status === 'completed' && execution.nodeExecutions.length === 0;
    
    if (hasTrackingIssues) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <PlayCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (execution: WorkflowExecution) => {
    const status = execution.status;
    
    // Check for execution tracking issues
    const hasTrackingIssues = status === 'completed' && execution.nodeExecutions.length === 0;
    
    const variants = {
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      issue: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    } as const;

    const displayStatus = hasTrackingIssues ? 'issue' : status;
    const displayText = hasTrackingIssues ? 'tracking issue' : status;

    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${variants[displayStatus as keyof typeof variants] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
      >
        {displayText}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const ExecutionItem = ({ execution }: { execution: WorkflowExecution }) => {
    const { date, time } = formatDateTime(execution.startedAt);
    const isSelected = selectedExecution?.id === execution.id;
    
    return (
      <motion.div
        layout
        onClick={() => onExecutionSelect(execution)}
        className={`
          p-3 rounded-lg border cursor-pointer transition-all duration-200
          hover:bg-gray-800/50 hover:border-gray-600
          ${isSelected 
            ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20' 
            : 'bg-gray-800/30 border-gray-700/50'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusIcon(execution)}
            <span className="text-sm font-medium text-gray-200 truncate">
              {execution.workflowName || `Execution ${execution.id.slice(0, 8)}`}
            </span>
          </div>
          {getStatusBadge(execution)}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{date}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
          </div>
        </div>

        {execution.completedAt && (
          <div className="mt-2 text-xs text-gray-500">
            Duration: {Math.round(
              (new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
            )}s
          </div>
        )}

        {execution.error && (
          <div className="mt-2 text-xs text-red-400 truncate">
            Error: {execution.error}
          </div>
        )}

        {/* Show tracking issues warning */}
        {execution.status === 'completed' && execution.nodeExecutions.length === 0 && (
          <div className="mt-2 text-xs text-yellow-400 truncate">
            ⚠️ Execution tracking incomplete - node execution data missing
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900/50 backdrop-blur-sm">
      <div className="p-4 border-b border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-3">Executions</h3>
        
        <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as 'production' | 'test')}>
          <TabsList className="w-full bg-gray-800/50 border border-gray-700/50">
            <TabsTrigger 
              value="production" 
              className="flex-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
            >
              Production
            </TabsTrigger>
            <TabsTrigger 
              value="test" 
              className="flex-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
            >
              Test
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-8">
            <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p>Loading executions...</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <PlayCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No {activeMode} executions found</p>
            <p className="text-xs mt-1">Run a workflow to see executions here</p>
          </div>
        ) : (
          <motion.div layout className="space-y-3">
            {executions.map((execution) => (
              <ExecutionItem key={execution.id} execution={execution} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ExecutionsList;