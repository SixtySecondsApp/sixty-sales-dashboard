import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Map,
  Plus,
  Filter,
  Search,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Lightbulb,
  Bug,
  ArrowUp,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoadmap, RoadmapSuggestion } from '@/lib/hooks/useRoadmap';
import { useUser } from '@/lib/hooks/useUser';
import { RoadmapKanban, RoadmapKanbanHandle } from '@/components/roadmap/RoadmapKanban';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

const colorClasses = {
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    text: 'text-gray-500'
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-500'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-500'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-500'
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-500'
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-500'
  }
} as const;

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const colorClass = colorClasses[color as keyof typeof colorClasses] || colorClasses.gray;
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClass.bg} border ${colorClass.border}`}>
          <Icon className={`w-6 h-6 ${colorClass.text}`} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export default function Roadmap() {
  const { suggestions, loading, error } = useRoadmap();
  const { userData } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<RoadmapSuggestion['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RoadmapSuggestion['status'] | 'all'>('all');

  const isAdmin = userData?.is_admin || false;

  // Filter suggestions based on search and filters
  const filteredSuggestions = suggestions.filter(suggestion => {
    const matchesSearch = !searchQuery || 
      suggestion.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suggestion.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || suggestion.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || suggestion.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: suggestions.length,
    completed: suggestions.filter(s => s.status === 'completed').length,
    inProgress: suggestions.filter(s => s.status === 'in_progress').length,
    pending: suggestions.filter(s => s.status === 'submitted').length,
  };

  const typeStats = {
    features: suggestions.filter(s => s.type === 'feature').length,
    bugs: suggestions.filter(s => s.type === 'bug').length,
    improvements: suggestions.filter(s => s.type === 'improvement').length,
    other: suggestions.filter(s => s.type === 'other').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded-lg w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="h-96 bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Roadmap</h2>
            <p className="text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Map className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Product Roadmap</h1>
                <p className="text-gray-400">
                  Share your ideas, report bugs, and track development progress
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                roadmapKanbanRef.current?.openSuggestionForm();
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              Submit Feature Request
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Suggestions"
            value={stats.total}
            icon={BarChart3}
            color="blue"
            subtitle="All time submissions"
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            color="green"
            subtitle="Successfully implemented"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={Clock}
            color="yellow"
            subtitle="Currently being developed"
          />
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={Users}
            color="purple"
            subtitle="Awaiting evaluation"
          />
        </div>

        {/* Type Breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Features</p>
                <p className="text-lg font-semibold text-white">{typeStats.features}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <Bug className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm text-gray-400">Bugs</p>
                <p className="text-lg font-semibold text-white">{typeStats.bugs}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <ArrowUp className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-gray-400">Improvements</p>
                <p className="text-lg font-semibold text-white">{typeStats.improvements}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Other</p>
                <p className="text-lg font-semibold text-white">{typeStats.other}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suggestions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="feature">Features</option>
              <option value="bug">Bugs</option>
              <option value="improvement">Improvements</option>
              <option value="other">Other</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="in_progress">In Progress</option>
              <option value="testing">Testing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-gray-400">
            Showing {filteredSuggestions.length} of {suggestions.length} suggestions
          </p>
          {isAdmin && (
            <div className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Admin Mode: You can drag & drop to manage suggestions
            </div>
          )}
        </div>

        {/* Kanban Board */}
        <RoadmapKanban />
      </div>
    </div>
  );
}