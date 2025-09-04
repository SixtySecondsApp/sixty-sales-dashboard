import React from 'react';
import { motion } from 'framer-motion';
import { Zap, CheckCircle, Activity, TrendingUp } from 'lucide-react';

interface StatsPanelProps {
  stats: {
    activeRules: number;
    successRate: number;
    totalExecutions: number;
  };
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  return (
    <div className="space-y-4">
      {/* Active Rules Card */}
      <motion.div 
        whileHover={{ y: -2, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Active Rules</p>
            <p className="text-3xl font-bold text-white">{stats.activeRules}</p>
            <p className="text-xs text-[#37bd7e] mt-1">Running automations</p>
          </div>
          <div className="w-12 h-12 bg-[#37bd7e]/10 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-[#37bd7e]" />
          </div>
        </div>
      </motion.div>

      {/* Success Rate Card */}
      <motion.div 
        whileHover={{ y: -2, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Success Rate</p>
            <p className="text-3xl font-bold text-white">{stats.successRate}%</p>
            <p className="text-xs text-blue-400 mt-1">Last 30 days</p>
          </div>
          <div className="w-12 h-12 bg-blue-600/10 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-blue-400" />
          </div>
        </div>
      </motion.div>

      {/* Total Executions Card */}
      <motion.div 
        whileHover={{ y: -2, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Total Executions</p>
            <p className="text-3xl font-bold text-white">{stats.totalExecutions}</p>
            <p className="text-xs text-purple-400 mt-1">All time</p>
          </div>
          <div className="w-12 h-12 bg-purple-600/10 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-purple-400" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StatsPanel;