import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Mail,
  Sparkles,
  TrendingUp,
  Eye,
  Check,
  Loader2,
  FileText,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  SalesTemplateService,
  type SalesTemplate,
  type TemplateCategory,
  type TemplateContext,
  type PersonalizedEmail
} from '@/lib/services/salesTemplateService';
import { cn } from '@/lib/utils';
import logger from '@/lib/utils/logger';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: PersonalizedEmail) => void;
  context?: TemplateContext;
  userId?: string;
  categoryFilter?: TemplateCategory;
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  meeting_followup: 'Meeting Follow-up',
  initial_outreach: 'Initial Outreach',
  nurture_sequence: 'Nurture Sequence',
  deal_progression: 'Deal Progression',
  reengagement: 'Re-engagement',
  thank_you: 'Thank You',
  custom: 'Custom'
};

export function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelect,
  context,
  userId,
  categoryFilter
}: TemplateSelectorModalProps) {
  const [templates, setTemplates] = useState<SalesTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<SalesTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<SalesTemplate | null>(null);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [preview, setPreview] = useState<PersonalizedEmail | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [enrichContext, setEnrichContext] = useState(true); // Enable LinkedIn enrichment

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, categoryFilter]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await SalesTemplateService.getTemplates({
        category: categoryFilter,
        includeShared: true,
        includeDefault: true
      });
      setTemplates(data);
      setFilteredTemplates(data);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    if (!searchQuery) {
      setFilteredTemplates(templates);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.subject_template.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
    setFilteredTemplates(filtered);
  };

  const handleTemplateSelect = async (template: SalesTemplate) => {
    if (!context) {
      // If no context, just use the template as-is
      onSelect({
        subject: template.subject_template,
        body: template.body_template,
        tone: template.tone,
        variables_used: {},
        ai_personalized: false
      });
      onClose();
      return;
    }

    setSelectedTemplate(template);
    setIsPersonalizing(true);

    try {
      logger.log('🎨 Personalizing template with context...');

      const personalized = await SalesTemplateService.personalizeTemplate(
        template.id,
        context,
        {
          skipAI: false, // Enable AI personalization
          userId: userId,
          enrichContext: enrichContext // Enable LinkedIn/smart context enrichment
        }
      );

      setPreview(personalized);
      setShowPreview(true);
      logger.log('✅ Template personalized successfully');
    } catch (error) {
      logger.error('Error personalizing template:', error);
      toast.error('Failed to personalize template');

      // Fallback to basic template
      onSelect({
        subject: template.subject_template,
        body: template.body_template,
        tone: template.tone,
        variables_used: {},
        ai_personalized: false
      });
      onClose();
    } finally {
      setIsPersonalizing(false);
    }
  };

  const handleUsePersonalized = () => {
    if (preview) {
      onSelect(preview);

      // Log usage for analytics
      if (selectedTemplate && context) {
        SalesTemplateService.logUsage({
          template_id: selectedTemplate.id,
          user_id: userId || '',
          used_for: context.calendar_event ? 'calendar_followup' : 'email',
          contact_id: context.contact?.id,
          deal_id: context.deal?.id,
          calendar_event_id: context.calendar_event?.id,
          email_sent: false,
          ai_personalized: preview.ai_personalized,
          personalization_quality: preview.personalization_quality
        });
      }
    }
    setShowPreview(false);
    onClose();
  };

  const handleCancel = () => {
    setShowPreview(false);
    setPreview(null);
    setSelectedTemplate(null);
  };

  const getCategoryBadgeColor = (category: TemplateCategory): string => {
    const colors: Record<TemplateCategory, string> = {
      meeting_followup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      initial_outreach: 'bg-green-500/20 text-green-400 border-green-500/30',
      nurture_sequence: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      deal_progression: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      reengagement: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      thank_you: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      custom: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[category];
  };

  const getQualityBadge = (quality?: number) => {
    if (!quality) return null;

    const percentage = Math.round(quality * 100);
    const color = percentage >= 80 ? 'text-green-400 bg-green-500/20' :
                  percentage >= 60 ? 'text-yellow-400 bg-yellow-500/20' :
                  'text-gray-400 bg-gray-500/20';

    return (
      <Badge className={color}>
        Quality: {percentage}%
      </Badge>
    );
  };

  return (
    <>
      {/* Template Selection Modal */}
      <Dialog open={isOpen && !showPreview} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#37bd7e]" />
              Select Email Template
            </DialogTitle>
            <DialogDescription>
              Choose a template to start with. It will be personalized with AI based on your context.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Enrichment Toggle */}
          {context && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <input
                type="checkbox"
                id="enrichContext"
                checked={enrichContext}
                onChange={(e) => setEnrichContext(e.target.checked)}
                className="rounded border-gray-700"
              />
              <label htmlFor="enrichContext" className="text-sm flex items-center gap-2 cursor-pointer">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>
                  Use AI-powered context enrichment (LinkedIn, pain points, value propositions)
                </span>
              </label>
            </div>
          )}

          {/* Template List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {searchQuery
                    ? 'No templates found matching your search'
                    : 'No templates available'}
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card
                    className={cn(
                      "p-4 cursor-pointer transition-all hover:bg-gray-800/50 hover:border-[#37bd7e]/50",
                      isPersonalizing && selectedTemplate?.id === template.id && "border-[#37bd7e] bg-gray-800/50"
                    )}
                    onClick={() => !isPersonalizing && handleTemplateSelect(template)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{template.name}</h3>
                          <Badge className={getCategoryBadgeColor(template.category)}>
                            {CATEGORY_LABELS[template.category]}
                          </Badge>
                          {template.is_default && (
                            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                              Default
                            </Badge>
                          )}
                          {template.ai_instructions && (
                            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Enhanced
                            </Badge>
                          )}
                        </div>

                        {template.description && (
                          <p className="text-sm text-gray-400">{template.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {template.usage_count} uses
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {template.avg_response_rate.toFixed(0)}% response
                          </span>
                          <span className="capitalize">{template.tone} tone</span>
                        </div>

                        <div className="bg-gray-800/50 rounded p-2 text-xs">
                          <div className="font-medium text-gray-400 mb-1">Subject:</div>
                          <div className="text-gray-300">{template.subject_template}</div>
                        </div>
                      </div>

                      {isPersonalizing && selectedTemplate?.id === template.id ? (
                        <div className="flex items-center gap-2 text-[#37bd7e]">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">Personalizing...</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-[#37bd7e] hover:bg-[#2da76c]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateSelect(template);
                          }}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Use
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#37bd7e]" />
              AI-Personalized Preview
            </DialogTitle>
            <DialogDescription>
              Review the AI-personalized email before using it
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Quality Indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                {preview.ai_personalized && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Personalized
                  </Badge>
                )}
                {preview.smart_context_used && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <Zap className="w-3 h-3 mr-1" />
                    Smart Context Applied
                  </Badge>
                )}
                {getQualityBadge(preview.personalization_quality)}
                <Badge variant="outline" className="capitalize">
                  {preview.tone} Tone
                </Badge>
              </div>

              {/* Subject Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Subject Line</label>
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="font-medium">{preview.subject}</p>
                </div>
              </div>

              {/* Body Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Email Body</label>
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {preview.body}
                  </pre>
                </div>
              </div>

              {/* Variables Used */}
              {Object.keys(preview.variables_used).length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">Personalization Variables</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preview.variables_used).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Personalization Info */}
              {preview.ai_personalized && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-400">AI-Enhanced</p>
                      <p className="text-xs text-gray-400">
                        This email was personalized using AI based on {' '}
                        {preview.smart_context_used
                          ? 'LinkedIn profile data, meeting notes, and identified pain points'
                          : 'your contact and meeting context'}
                        . The AI maintained the {preview.tone} tone while adding specific, relevant details.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <Button variant="ghost" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setSelectedTemplate(null);
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Choose Different Template
              </Button>
              <Button
                className="bg-[#37bd7e] hover:bg-[#2da76c]"
                onClick={handleUsePersonalized}
              >
                <Check className="w-4 h-4 mr-2" />
                Use This Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
