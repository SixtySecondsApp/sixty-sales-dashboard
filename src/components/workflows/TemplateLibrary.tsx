import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen,
  Search,
  Filter,
  Star,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  Mail,
  CheckSquare,
  Bell,
  Target,
  Activity,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  color: string;
  popularity: number;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  tags: string[];
}

const templates: Template[] = [
  {
    id: '1',
    name: 'Follow-up After Proposal',
    description: 'Automatically create follow-up tasks 3 days after sending a proposal',
    category: 'Sales',
    icon: Mail,
    color: 'bg-blue-600',
    popularity: 95,
    difficulty: 'easy',
    estimatedTime: '2 min',
    tags: ['proposal', 'follow-up', 'automation']
  },
  {
    id: '2',
    name: 'Deal Stage Notifications',
    description: 'Send notifications when deals move between pipeline stages',
    category: 'Sales',
    icon: Target,
    color: 'bg-purple-600',
    popularity: 88,
    difficulty: 'easy',
    estimatedTime: '3 min',
    tags: ['pipeline', 'notification', 'stage']
  },
  {
    id: '3',
    name: 'Task Assignment Flow',
    description: 'Auto-assign tasks based on team member availability and expertise',
    category: 'Productivity',
    icon: CheckSquare,
    color: 'bg-[#37bd7e]',
    popularity: 92,
    difficulty: 'medium',
    estimatedTime: '5 min',
    tags: ['tasks', 'team', 'assignment']
  },
  {
    id: '4',
    name: 'Customer Onboarding',
    description: 'Complete onboarding workflow for new customers with tasks and emails',
    category: 'Customer Success',
    icon: Users,
    color: 'bg-indigo-600',
    popularity: 85,
    difficulty: 'hard',
    estimatedTime: '10 min',
    tags: ['onboarding', 'customer', 'sequence']
  },
  {
    id: '5',
    name: 'Revenue Alerts',
    description: 'Get alerts for high-value deals and revenue milestones',
    category: 'Sales',
    icon: DollarSign,
    color: 'bg-green-600',
    popularity: 90,
    difficulty: 'easy',
    estimatedTime: '2 min',
    tags: ['revenue', 'alerts', 'deals']
  },
  {
    id: '6',
    name: 'Activity Reminder',
    description: 'Remind team members about overdue activities and meetings',
    category: 'Productivity',
    icon: Activity,
    color: 'bg-orange-600',
    popularity: 78,
    difficulty: 'easy',
    estimatedTime: '3 min',
    tags: ['reminder', 'activity', 'meeting']
  }
];

const categories = ['All', 'Sales', 'Productivity', 'Customer Success', 'Marketing'];

interface TemplateLibraryProps {
  onSelectTemplate: (template: any) => void;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ onSelectTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popularity' | 'difficulty' | 'name'>('popularity');

  const filteredTemplates = templates
    .filter(t => selectedCategory === 'All' || t.category === selectedCategory)
    .filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'popularity') return b.popularity - a.popularity;
      if (sortBy === 'difficulty') {
        const diffOrder = { easy: 0, medium: 1, hard: 2 };
        return diffOrder[a.difficulty] - diffOrder[b.difficulty];
      }
      return a.name.localeCompare(b.name);
    });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Template Library</h2>
        <p className="text-gray-400">Start with a pre-built workflow template and customize it to your needs</p>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-[#37bd7e] text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-[#37bd7e] outline-none transition-colors"
        >
          <option value="popularity">Most Popular</option>
          <option value="difficulty">Difficulty</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template, index) => {
          const Icon = template.icon;
          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => onSelectTemplate(template)}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6 cursor-pointer hover:border-[#37bd7e]/50 transition-all group"
            >
              {/* Icon and Category */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${template.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(template.difficulty)}`}>
                    {template.difficulty}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-400">{template.popularity}%</span>
                  </div>
                </div>
              </div>

              {/* Title and Description */}
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#37bd7e] transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {template.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {template.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-gray-800/50 rounded text-xs text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{template.estimatedTime}</span>
                </div>
                <div className="flex items-center gap-1 text-[#37bd7e] opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium">Use Template</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-400 mb-1">No templates found</h3>
          <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Featured Badge */}
      <div className="mt-12 p-6 bg-gradient-to-r from-[#37bd7e]/10 to-purple-600/10 rounded-lg border border-[#37bd7e]/20">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#37bd7e]" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Want a custom template?</h3>
            <p className="text-sm text-gray-400">
              Contact our team to create a custom workflow template tailored to your specific needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateLibrary;