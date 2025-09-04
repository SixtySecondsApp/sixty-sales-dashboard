import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Users,
  Target,
  DollarSign,
  Zap,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

const WorkflowInsights: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'executions' | 'success' | 'performance'>('executions');

  // Mock data for charts
  const executionTrend = [
    { date: 'Mon', successful: 45, failed: 5 },
    { date: 'Tue', successful: 52, failed: 8 },
    { date: 'Wed', successful: 48, failed: 3 },
    { date: 'Thu', successful: 63, failed: 7 },
    { date: 'Fri', successful: 58, failed: 4 },
    { date: 'Sat', successful: 35, failed: 2 },
    { date: 'Sun', successful: 42, failed: 3 }
  ];

  const performanceData = [
    { time: '00:00', avgTime: 245, executions: 12 },
    { time: '04:00', avgTime: 198, executions: 8 },
    { time: '08:00', avgTime: 312, executions: 45 },
    { time: '12:00', avgTime: 289, executions: 62 },
    { time: '16:00', avgTime: 356, executions: 58 },
    { time: '20:00', avgTime: 267, executions: 35 }
  ];

  const workflowDistribution = [
    { name: 'Sales', value: 35, color: '#37bd7e' },
    { name: 'Tasks', value: 28, color: '#3B82F6' },
    { name: 'Notifications', value: 22, color: '#A855F7' },
    { name: 'Data Updates', value: 15, color: '#F59E0B' }
  ];

  const topWorkflows = [
    { name: 'Follow-up After Proposal', executions: 342, successRate: 96, impact: '+24%' },
    { name: 'Deal Stage Notifications', executions: 289, successRate: 92, impact: '+18%' },
    { name: 'Task Auto-Assignment', executions: 256, successRate: 89, impact: '+15%' },
    { name: 'Revenue Milestone Alerts', executions: 198, successRate: 98, impact: '+12%' },
    { name: 'Activity Reminders', executions: 145, successRate: 85, impact: '+8%' }
  ];

  const metrics = {
    totalExecutions: 1430,
    executionChange: 12,
    successRate: 92,
    successChange: 3,
    avgExecutionTime: 287,
    timeChange: -15,
    activeWorkflows: 23,
    workflowChange: 2
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Workflow Insights</h2>
            <p className="text-gray-400">Analytics and performance metrics for your automations</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex bg-gray-800/50 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-[#37bd7e] text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
            
            <button className="p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
            
            <button className="p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors">
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-blue-400" />
            <span className={`text-xs font-medium flex items-center gap-1 ${
              metrics.executionChange > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {metrics.executionChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(metrics.executionChange)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.totalExecutions.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Executions</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <span className={`text-xs font-medium flex items-center gap-1 ${
              metrics.successChange > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {metrics.successChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(metrics.successChange)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.successRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Success Rate</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-purple-400" />
            <span className={`text-xs font-medium flex items-center gap-1 ${
              metrics.timeChange < 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {metrics.timeChange < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {Math.abs(metrics.timeChange)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.avgExecutionTime}ms</p>
          <p className="text-xs text-gray-400 mt-1">Avg Execution Time</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 text-[#37bd7e]" />
            <span className={`text-xs font-medium flex items-center gap-1 ${
              metrics.workflowChange > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {metrics.workflowChange > 0 ? '+' : ''}{metrics.workflowChange}
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.activeWorkflows}</p>
          <p className="text-xs text-gray-400 mt-1">Active Workflows</p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Execution Trend Chart */}
        <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Execution Trend</h3>
            <div className="flex gap-2">
              {(['executions', 'success', 'performance'] as const).map(metric => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                    selectedMetric === metric
                      ? 'bg-[#37bd7e] text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {metric}
                </button>
              ))}
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            {selectedMetric === 'performance' ? (
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#37bd7e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#37bd7e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Area type="monotone" dataKey="avgTime" stroke="#37bd7e" fillOpacity={1} fill="url(#colorTime)" />
              </AreaChart>
            ) : (
              <BarChart data={executionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Legend />
                <Bar dataKey="successful" stackId="a" fill="#37bd7e" />
                <Bar dataKey="failed" stackId="a" fill="#EF4444" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Workflow Distribution */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Workflow Distribution</h3>
          
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={workflowDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {workflowDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="space-y-2 mt-4">
            {workflowDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-400">{item.name}</span>
                </div>
                <span className="text-sm text-white font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performing Workflows */}
      <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Top Performing Workflows</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase">
                <th className="pb-3">Workflow</th>
                <th className="pb-3 text-right">Executions</th>
                <th className="pb-3 text-right">Success Rate</th>
                <th className="pb-3 text-right">Business Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {topWorkflows.map((workflow, index) => (
                <motion.tr
                  key={workflow.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#37bd7e]/20 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-[#37bd7e]" />
                      </div>
                      <span className="text-sm text-white group-hover:text-[#37bd7e] transition-colors">
                        {workflow.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm text-gray-400">{workflow.executions}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className={`text-sm font-medium ${
                      workflow.successRate >= 95 ? 'text-green-400' :
                      workflow.successRate >= 85 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {workflow.successRate}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-medium text-[#37bd7e]">{workflow.impact}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Summary */}
      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-1">Peak Performance</h4>
              <p className="text-xs text-gray-300">
                Workflows are most active during business hours (12-4 PM) with 62 executions/hour average.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-1">High Reliability</h4>
              <p className="text-xs text-gray-300">
                92% success rate across all workflows, exceeding the 85% industry benchmark.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-600/10 border border-purple-600/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-purple-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-1">Optimization Opportunity</h4>
              <p className="text-xs text-gray-300">
                3 workflows show slower execution times and could benefit from optimization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowInsights;