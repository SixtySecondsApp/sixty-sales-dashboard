import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Database,
  GitBranch
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  canvas_data: any;
  trigger_type: string;
  trigger_conditions: any;
  action_type: string;
  action_config: any;
  difficulty_level: 'easy' | 'medium' | 'hard';
  estimated_setup_time: number;
  tags: string[];
  usage_count: number;
  rating_avg: number;
  rating_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// Icon mapping for templates
const iconMap: { [key: string]: any } = {
  Target,
  Activity,
  Database,
  GitBranch,
  CheckSquare,
  Bell,
  Mail,
  Users,
  DollarSign,
  TrendingUp
};

// Category colors for visual distinction
const categoryColors: { [key: string]: string } = {
  sales: 'bg-blue-600',
  productivity: 'bg-[#37bd7e]',
  'customer success': 'bg-indigo-600',
  marketing: 'bg-purple-600',
  general: 'bg-gray-600'
};

const categories = ['All', 'sales', 'productivity', 'customer success', 'marketing', 'general'];

interface TemplateLibraryProps {
  onSelectTemplate: (template: any) => void;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ onSelectTemplate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'usage_count' | 'difficulty_level' | 'name' | 'rating_avg'>('usage_count');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_public', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    try {
      // Increment usage count
      await supabase
        .from('workflow_templates')
        .update({ usage_count: template.usage_count + 1 })
        .eq('id', template.id);

      // Convert template to workflow format for the canvas
      const workflowData = {
        id: template.id,
        name: template.name,
        description: template.description,
        canvas_data: template.canvas_data,
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_conditions,
        action_type: template.action_type,
        action_config: template.action_config,
        is_active: false, // Start inactive
        template_id: template.id
      };

      onSelectTemplate(workflowData);
    } catch (error) {
      console.error('Error selecting template:', error);
    }
  };

  const filteredTemplates = templates
    .filter(t => selectedCategory === 'All' || t.category === selectedCategory)
    .filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'usage_count') return b.usage_count - a.usage_count;
      if (sortBy === 'rating_avg') return (b.rating_avg || 0) - (a.rating_avg || 0);
      if (sortBy === 'difficulty_level') {
        const diffOrder = { easy: 0, medium: 1, hard: 2 };
        return diffOrder[a.difficulty_level] - diffOrder[b.difficulty_level];
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Template Library</h2>
            <p className="text-gray-400">Start with a pre-built workflow template and customize it to your needs</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">{templates.length} templates available</p>
            <p className="text-xs text-gray-500">Community curated workflows</p>
          </div>
        </div>
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
        <div className="flex gap-2 flex-wrap">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
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
          <option value="usage_count">Most Popular</option>
          <option value="rating_avg">Highest Rated</option>
          <option value="difficulty_level">Difficulty</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template, index) => {
          // Get appropriate icon based on trigger/action type
          const getTemplateIcon = () => {
            if (template.trigger_type === 'stage_changed') return Target;
            if (template.trigger_type === 'activity_created') return Activity;
            if (template.trigger_type === 'deal_created') return Database;
            if (template.action_type === 'create_task') return CheckSquare;
            if (template.action_type === 'send_notification') return Bell;
            return GitBranch;
          };
          
          const Icon = getTemplateIcon();
          const categoryColor = categoryColors[template.category] || categoryColors.general;
          
          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleTemplateSelect(template)}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6 cursor-pointer hover:border-[#37bd7e]/50 transition-all group"
            >
              {/* Icon and Category */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${categoryColor} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(template.difficulty_level)}`}>
                    {template.difficulty_level}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-400">
                      {template.rating_count > 0 ? template.rating_avg.toFixed(1) : 'New'}
                    </span>
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
                {template.tags?.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-gray-800/50 rounded text-xs text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{template.estimated_setup_time} min</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <TrendingUp className="w-3 h-3" />
                    <span>{template.usage_count} uses</span>
                  </div>
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