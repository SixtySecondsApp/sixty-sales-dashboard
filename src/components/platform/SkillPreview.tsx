/**
 * SkillPreview Component
 *
 * Preview component for viewing skill templates and compiled output.
 * Supports toggling between raw template and compiled view with sample context.
 */

import { useState, useMemo } from 'react';
import { Code, Eye, AlertTriangle, Copy, Check, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  type PlatformSkill,
  extractVariablesFromTemplate,
  getAvailableContextVariables,
} from '@/lib/hooks/usePlatformSkills';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { buildSkillResponseFormatExport, writeJsonToClipboard } from '@/lib/utils/responseFormatExport';

interface SkillPreviewProps {
  skill: PlatformSkill;
  onClose?: () => void;
  sampleContext?: Record<string, unknown>;
}

type ViewMode = 'template' | 'compiled';

// Sample context for preview
const DEFAULT_SAMPLE_CONTEXT: Record<string, unknown> = {
  company_name: 'Acme Corporation',
  domain: 'acme.com',
  tagline: 'Building the future, today',
  description: 'Leading provider of innovative business solutions',
  industry: 'Technology',
  employee_count: '250-500',
  products: [
    { name: 'AcmeFlow', description: 'Workflow automation platform' },
    { name: 'AcmeSync', description: 'Data synchronization tool' },
  ],
  main_product: 'AcmeFlow',
  value_propositions: ['Save 40% time on manual tasks', 'Real-time collaboration', '99.9% uptime'],
  competitors: ['CompetitorA', 'CompetitorB', 'CompetitorC'],
  primary_competitor: 'CompetitorA',
  target_market: 'Enterprise B2B SaaS companies',
  target_customers: 'Operations managers and IT directors',
  icp_summary: {
    company_size: '100-1000 employees',
    industries: ['SaaS', 'FinTech', 'E-commerce'],
    pain_points: ['Manual data entry', 'Siloed systems'],
  },
  tech_stack: ['React', 'Node.js', 'PostgreSQL'],
  buying_signals: ['Budget discussions', 'RFP requests', 'Demo requests'],
};

export function SkillPreview({ skill, onClose, sampleContext }: SkillPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('template');
  const [copied, setCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(false);

  const context = { ...DEFAULT_SAMPLE_CONTEXT, ...sampleContext };

  // Extract variables from template
  const requiredVariables = useMemo(() => {
    return extractVariablesFromTemplate(skill.content_template);
  }, [skill.content_template]);

  // Compile template with context
  const compiledContent = useMemo(() => {
    let content = skill.content_template;

    // Replace ${variable} patterns
    content = content.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      const [path, ...modifiers] = expression.split('|').map((s: string) => s.trim());

      // Get value from context
      let value = getNestedValue(path, context);

      // Check for default value
      if (value === undefined || value === null) {
        const defaultModifier = modifiers.find((m: string) => m.startsWith("'") && m.endsWith("'"));
        if (defaultModifier) {
          value = defaultModifier.slice(1, -1);
        } else {
          return match; // Keep original if no value
        }
      }

      // Apply formatters
      for (const mod of modifiers) {
        if (mod.startsWith('join(')) {
          const separator = mod.match(/join\(['"](.+)['"]\)/)?.[1] || ', ';
          if (Array.isArray(value)) {
            value = value.join(separator);
          }
        } else if (mod === 'upper') {
          value = String(value).toUpperCase();
        } else if (mod === 'lower') {
          value = String(value).toLowerCase();
        }
      }

      return String(value ?? '');
    });

    return content;
  }, [skill.content_template, context]);

  // Check for missing variables
  const missingVariables = useMemo(() => {
    return requiredVariables.filter((v) => {
      const value = getNestedValue(v, context);
      return value === undefined || value === null;
    });
  }, [requiredVariables, context]);

  const handleCopy = async () => {
    const content = viewMode === 'template' ? skill.content_template : compiledContent;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFormatJson = async () => {
    try {
      await writeJsonToClipboard({
        kind: 'skill-response-format',
        generatedAt: new Date().toISOString(),
        skill: buildSkillResponseFormatExport(skill),
      });
      setCopiedFormat(true);
      setTimeout(() => setCopiedFormat(false), 2000);
      toast.success('Copied format JSON');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with view toggle */}
      <div className="border-b border-gray-200 dark:border-gray-700/50 px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
        {/* View Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('template')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              viewMode === 'template'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Code className="w-3.5 h-3.5" />
            Template
          </button>
          <button
            onClick={() => setViewMode('compiled')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              viewMode === 'compiled'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Compiled
          </button>
        </div>

        {/* Copy buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyFormatJson} className="gap-1.5">
            {copiedFormat ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                Copied JSON
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy format JSON
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Frontmatter Display */}
      <div className="border-b border-gray-200 dark:border-gray-700/50 px-4 py-3 bg-gray-50/50 dark:bg-gray-800/20">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              Skill Key
            </span>
            <p className="font-mono text-gray-900 dark:text-gray-100 mt-0.5">
              {skill.skill_key}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              Version
            </span>
            <p className="text-gray-900 dark:text-gray-100 mt-0.5">v{skill.version}</p>
          </div>
        </div>

        {/* Triggers */}
        {skill.frontmatter.triggers && skill.frontmatter.triggers.length > 0 && (
          <div className="mt-3">
            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              Triggers
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {skill.frontmatter.triggers.map((trigger, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-xs"
                >
                  {trigger}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Required Context */}
        {skill.frontmatter.requires_context && skill.frontmatter.requires_context.length > 0 && (
          <div className="mt-3">
            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              Required Context
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {skill.frontmatter.requires_context.map((ctx, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs font-mono"
                >
                  {ctx}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Missing Variables Warning */}
      {viewMode === 'compiled' && missingVariables.length > 0 && (
        <div className="border-b border-amber-200 dark:border-amber-800 px-4 py-3 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Missing Variables
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                The following variables are not in the sample context:{' '}
                {missingVariables.map((v, i) => (
                  <code
                    key={v}
                    className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded mx-0.5"
                  >
                    {v}
                  </code>
                ))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'template' ? (
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
            {skill.content_template}
          </pre>
        ) : (
          <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:bg-indigo-50 dark:prose-code:bg-indigo-900/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{compiledContent}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Sample Context Info */}
      {viewMode === 'compiled' && (
        <div className="border-t border-gray-200 dark:border-gray-700/50 px-4 py-3 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Settings className="w-3.5 h-3.5" />
            <span>Compiled with sample context data for preview</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get nested value from object
function getNestedValue(path: string, obj: Record<string, unknown>): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
