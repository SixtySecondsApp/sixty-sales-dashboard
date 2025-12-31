/**
 * SkillDetailPage - Shareable skill detail view
 *
 * Provides a shareable URL for viewing a compiled skill.
 * Shows the skill content with proper formatting and context.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Database,
  Workflow,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type SkillCategory = 'sales-ai' | 'writing' | 'enrichment' | 'workflows';

const CATEGORY_ICONS: Record<SkillCategory, React.ElementType> = {
  'sales-ai': Sparkles,
  writing: FileText,
  enrichment: Database,
  workflows: Workflow,
};

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  'sales-ai': 'from-indigo-500 to-purple-600',
  writing: 'from-emerald-500 to-teal-600',
  enrichment: 'from-blue-500 to-cyan-600',
  workflows: 'from-orange-500 to-amber-600',
};

interface CompiledSkill {
  id: string;
  skill_id: string;
  skill_name: string;
  is_enabled: boolean;
  platform_skill_id: string;
  platform_skill_version: number;
  compiled_frontmatter: {
    name: string;
    description: string;
    triggers?: string[];
    requires_context?: string[];
    outputs?: string[];
    priority?: string;
    [key: string]: unknown;
  };
  compiled_content: string;
  platform_skills: {
    skill_key: string;
    category: SkillCategory;
    frontmatter: Record<string, unknown>;
    is_active: boolean;
  };
}

async function fetchSkillByKey(
  orgId: string,
  skillKey: string
): Promise<CompiledSkill | null> {
  const { data, error } = await supabase
    .from('organization_skills')
    .select(`
      id,
      skill_id,
      skill_name,
      is_enabled,
      platform_skill_id,
      platform_skill_version,
      compiled_frontmatter,
      compiled_content,
      platform_skills!inner (
        skill_key,
        category,
        frontmatter,
        is_active
      )
    `)
    .eq('organization_id', orgId)
    .eq('skill_id', skillKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching skill:', error);
    throw error;
  }

  return data as CompiledSkill | null;
}

export default function SkillDetailPage() {
  const { skillKey } = useParams<{ skillKey: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const [copied, setCopied] = useState(false);

  const {
    data: skill,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['skill-detail', currentOrg?.id, skillKey],
    queryFn: () => fetchSkillByKey(currentOrg!.id, skillKey!),
    enabled: !!currentOrg?.id && !!skillKey,
  });

  const handleCopyContent = () => {
    if (skill?.compiled_content) {
      navigator.clipboard.writeText(skill.compiled_content);
      setCopied(true);
      toast.success('Skill content copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('URL copied to clipboard');
  };

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Loading organization...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-12 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Skill not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            The skill "{skillKey}" could not be found or hasn't been compiled yet.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => navigate('/platform/skills')}>
              View All Skills
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const category = skill.platform_skills?.category || 'sales-ai';
  const CategoryIcon = CATEGORY_ICONS[category];
  const frontmatter = skill.compiled_frontmatter || {};

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700/50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Skill Header */}
          <div className="flex items-start gap-5 mb-8">
            <div
              className={cn(
                'p-4 rounded-xl bg-gradient-to-br text-white shadow-lg shrink-0',
                CATEGORY_COLORS[category]
              )}
            >
              <CategoryIcon className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {frontmatter.name || skill.skill_name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    skill.is_enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  )}
                >
                  {skill.is_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {frontmatter.description || 'No description available'}
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <CategoryIcon className="w-3.5 h-3.5" />
                  <span className="capitalize">{category.replace('-', ' ')}</span>
                </span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span>v{skill.platform_skill_version}</span>
                {frontmatter.priority && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {String(frontmatter.priority)} priority
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Triggers */}
          {frontmatter.triggers && frontmatter.triggers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Triggers
              </h3>
              <div className="flex flex-wrap gap-2">
                {frontmatter.triggers.map((trigger, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                  >
                    {trigger}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Skill Content */}
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Skill Content
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyContent}
                className="gap-1.5"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 overflow-x-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{skill.compiled_content}</ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Frontmatter Details */}
          {Object.keys(frontmatter).length > 3 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Metadata
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4">
                <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                  {JSON.stringify(frontmatter, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
