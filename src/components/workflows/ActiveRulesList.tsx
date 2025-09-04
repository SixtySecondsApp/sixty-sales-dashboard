import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, RefreshCw, Target, CheckSquare, Bell, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

interface ActiveRulesListProps {
  onSelectWorkflow: (workflow: any) => void;
  onRefresh: () => void;
}

const ActiveRulesList: React.FC<ActiveRulesListProps> = ({ onSelectWorkflow, onRefresh }) => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('user_automation_rules')
        .select('*')
        .order('created_at', { ascending: false });
      
      setRules(data || []);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'pipeline_stage_changed':
        return <Target className="w-4 h-4" />;
      case 'activity_created':
        return <Activity className="w-4 h-4" />;
      case 'task_completed':
        return <CheckSquare className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create_task':
        return <CheckSquare className="w-4 h-4" />;
      case 'create_activity':
        return <Activity className="w-4 h-4" />;
      case 'send_notification':
        return <Bell className="w-4 h-4" />;
      default:
        return <ArrowRight className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg">
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#37bd7e]" />
            Active Rules
          </h3>
          <button
            onClick={() => {
              loadRules();
              onRefresh();
            }}
            className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      <div className="p-2 max-h-96 overflow-y-auto scrollbar-none">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-800/30 rounded-lg" />
              ))}
            </div>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No automation rules yet</p>
            <p className="text-xs mt-1">Create your first workflow to get started</p>
          </div>
        ) : (
          <AnimatePresence>
            {rules.map((rule, index) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectWorkflow(rule)}
                className="flex items-center justify-between p-3 hover:bg-gray-800/30 rounded-lg transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-[#37bd7e]' : 'bg-gray-600'}`} />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-600/20 rounded flex items-center justify-center text-purple-400">
                      {getTriggerIcon(rule.trigger_type)}
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <div className="w-6 h-6 bg-[#37bd7e]/20 rounded flex items-center justify-center text-[#37bd7e]">
                      {getActionIcon(rule.action_type)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-[#37bd7e] transition-colors">
                      {rule.rule_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate max-w-[140px]">
                      {rule.rule_description || 'No description'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    rule.is_active 
                      ? 'bg-[#37bd7e]/10 text-[#37bd7e]' 
                      : 'bg-gray-800/50 text-gray-500'
                  }`}>
                    {rule.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ActiveRulesList;