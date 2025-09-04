import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderOpen,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Copy,
  Trash,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { formatDistanceToNow } from 'date-fns';

interface Workflow {
  id: string;
  rule_name: string;
  rule_description: string;
  trigger_type: string;
  action_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_executed?: string;
  execution_count?: number;
  success_rate?: number;
}

interface MyWorkflowsProps {
  onSelectWorkflow: (workflow: any) => void;
  onDeleteWorkflow: (id: string) => void;
}

const MyWorkflows: React.FC<MyWorkflowsProps> = ({ onSelectWorkflow, onDeleteWorkflow }) => {
  const { userData: user } = useUser();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, [user]);

  const loadWorkflows = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_automation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add mock execution data for demo
      const workflowsWithStats = (data || []).map(w => ({
        ...w,
        execution_count: Math.floor(Math.random() * 100),
        success_rate: 85 + Math.floor(Math.random() * 15),
        last_executed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      setWorkflows(workflowsWithStats);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (workflow: Workflow) => {
    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .insert({
          user_id: user?.id,
          rule_name: `${workflow.rule_name} (Copy)`,
          rule_description: workflow.rule_description,
          trigger_type: workflow.trigger_type,
          action_type: workflow.action_type,
          trigger_conditions: {},
          action_config: {},
          is_active: false
        });

      if (error) throw error;
      await loadWorkflows();
    } catch (error) {
      console.error('Error duplicating workflow:', error);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);

      if (error) throw error;
      await loadWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
    }
  };

  const filteredWorkflows = workflows
    .filter(w => {
      if (filterStatus === 'active') return w.is_active;
      if (filterStatus === 'inactive') return !w.is_active;
      return true;
    })
    .filter(w => 
      w.rule_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.rule_description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'pipeline_stage_changed': return Target;
      case 'activity_created': return Activity;
      default: return Zap;
    }
  };

  const getStatusColor = (workflow: Workflow) => {
    if (!workflow.is_active) return 'text-gray-400 bg-gray-400/10';
    if (workflow.success_rate && workflow.success_rate >= 95) return 'text-green-400 bg-green-400/10';
    if (workflow.success_rate && workflow.success_rate >= 80) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">My Workflows</h2>
        <p className="text-gray-400">Manage and monitor your automated workflows</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold text-white">{workflows.length}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-gray-600" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active</p>
              <p className="text-2xl font-bold text-[#37bd7e]">{workflows.filter(w => w.is_active).length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-[#37bd7e]" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Success</p>
              <p className="text-2xl font-bold text-blue-400">92%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Executions</p>
              <p className="text-2xl font-bold text-purple-400">{workflows.reduce((sum, w) => sum + (w.execution_count || 0), 0)}</p>
            </div>
            <Activity className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filterStatus === status
                  ? 'bg-[#37bd7e] text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredWorkflows.map((workflow, index) => {
            const TriggerIcon = getTriggerIcon(workflow.trigger_type);
            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-gray-900/50 backdrop-blur-xl border rounded-lg p-4 transition-all ${
                  selectedWorkflow === workflow.id 
                    ? 'border-[#37bd7e]/50' 
                    : 'border-gray-800/50 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left Side */}
                  <div 
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => onSelectWorkflow(workflow)}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      workflow.is_active ? 'bg-purple-600/20' : 'bg-gray-700'
                    }`}>
                      <TriggerIcon className={`w-5 h-5 ${
                        workflow.is_active ? 'text-purple-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{workflow.rule_name}</h3>
                      <p className="text-sm text-gray-400">{workflow.rule_description || 'No description'}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(workflow)}`}>
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last run {workflow.last_executed ? formatDistanceToNow(new Date(workflow.last_executed), { addSuffix: true }) : 'Never'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {workflow.execution_count || 0} executions
                        </span>
                        {workflow.success_rate && (
                          <span className="text-xs text-gray-500">
                            {workflow.success_rate}% success
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(workflow);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        workflow.is_active
                          ? 'bg-[#37bd7e]/10 text-[#37bd7e] hover:bg-[#37bd7e]/20'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {workflow.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(showMenu === workflow.id ? null : workflow.id);
                        }}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      
                      {showMenu === workflow.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                          <button
                            onClick={() => {
                              onSelectWorkflow(workflow);
                              setShowMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDuplicate(workflow);
                              setShowMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this workflow?')) {
                                onDeleteWorkflow(workflow.id);
                              }
                              setShowMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Trash className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredWorkflows.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-400 mb-1">No workflows found</h3>
          <p className="text-sm text-gray-500">
            {searchQuery || filterStatus !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Create your first workflow to get started'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MyWorkflows;