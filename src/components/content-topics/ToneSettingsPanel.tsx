/**
 * ToneSettingsPanel Component
 *
 * Configure tone settings for each content type
 * Features:
 * - Tab-based content type selection
 * - Tone style selector
 * - Formality slider
 * - Emoji usage toggle
 * - Brand voice description
 * - Words to avoid list
 * - Preferred keywords list
 * - CTA settings
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  MessageSquare,
  FileText,
  Video,
  Mail,
  Save,
  RotateCcw,
  X,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  useToneSettingsForm,
  DEFAULT_TONE_SETTINGS,
  type ToneSettings,
} from '@/lib/hooks/useContentToneSettings';
import type { ContentType } from '@/lib/services/contentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ToneSettingsPanelProps {
  onClose: () => void;
}

const contentTypeConfig = [
  { type: 'social' as ContentType, icon: MessageSquare, label: 'Social' },
  { type: 'blog' as ContentType, icon: FileText, label: 'Blog' },
  { type: 'video' as ContentType, icon: Video, label: 'Video' },
  { type: 'email' as ContentType, icon: Mail, label: 'Email' },
];

const toneStyles = [
  'conversational and engaging',
  'professional and authoritative',
  'energetic and conversational',
  'friendly and professional',
  'formal and precise',
  'casual and approachable',
  'inspiring and motivational',
  'technical and detailed',
];

const emojiOptions: ToneSettings['emoji_usage'][] = [
  'none',
  'minimal',
  'moderate',
  'liberal',
];

const ctaStyleOptions: ToneSettings['cta_style'][] = [
  'soft',
  'direct',
  'question',
  'none',
];

export function ToneSettingsPanel({ onClose }: ToneSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<ContentType>('social');

  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <CardTitle className="text-lg">Tone Settings</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentType)}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {contentTypeConfig.map(({ type, icon: Icon, label }) => (
              <TabsTrigger key={type} value={type} className="text-xs">
                <Icon className="w-3 h-3 mr-1.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {contentTypeConfig.map(({ type }) => (
            <TabsContent key={type} value={type}>
              <ToneSettingsForm contentType={type} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface ToneSettingsFormProps {
  contentType: ContentType;
}

function ToneSettingsForm({ contentType }: ToneSettingsFormProps) {
  const {
    formState,
    isDirty,
    isLoading,
    isSaving,
    resetForm,
    handleSubmit,
    setToneStyle,
    setFormalityLevel,
    setEmojiUsage,
    setBrandVoice,
    setWordsToAvoid,
    setPreferredKeywords,
    setIncludeCTA,
    setCTAStyle,
  } = useToneSettingsForm(contentType);

  const [newWordToAvoid, setNewWordToAvoid] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  // Add word to avoid
  const addWordToAvoid = () => {
    if (newWordToAvoid.trim()) {
      const current = formState.words_to_avoid || [];
      if (!current.includes(newWordToAvoid.trim())) {
        setWordsToAvoid([...current, newWordToAvoid.trim()]);
      }
      setNewWordToAvoid('');
    }
  };

  // Remove word to avoid
  const removeWordToAvoid = (word: string) => {
    const current = formState.words_to_avoid || [];
    setWordsToAvoid(current.filter((w) => w !== word));
  };

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim()) {
      const current = formState.preferred_keywords || [];
      if (!current.includes(newKeyword.trim())) {
        setPreferredKeywords([...current, newKeyword.trim()]);
      }
      setNewKeyword('');
    }
  };

  // Remove keyword
  const removeKeyword = (keyword: string) => {
    const current = formState.preferred_keywords || [];
    setPreferredKeywords(current.filter((k) => k !== keyword));
  };

  // Handle form submission
  const onSubmit = () => {
    handleSubmit();
    toast.success('Tone settings saved!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tone Style */}
      <div className="space-y-2">
        <Label htmlFor="tone-style">Tone Style</Label>
        <Select
          value={formState.tone_style || ''}
          onValueChange={setToneStyle}
        >
          <SelectTrigger id="tone-style">
            <SelectValue placeholder="Select tone style" />
          </SelectTrigger>
          <SelectContent>
            {toneStyles.map((style) => (
              <SelectItem key={style} value={style}>
                {style}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Formality Level */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Formality Level</Label>
          <span className="text-sm text-muted-foreground">
            {formState.formality_level || 5}/10
          </span>
        </div>
        <Slider
          value={[formState.formality_level || 5]}
          onValueChange={([value]) => setFormalityLevel(value)}
          min={1}
          max={10}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Casual</span>
          <span>Formal</span>
        </div>
      </div>

      {/* Emoji Usage */}
      <div className="space-y-2">
        <Label htmlFor="emoji-usage">Emoji Usage</Label>
        <Select
          value={formState.emoji_usage || 'none'}
          onValueChange={(v) => setEmojiUsage(v as ToneSettings['emoji_usage'])}
        >
          <SelectTrigger id="emoji-usage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {emojiOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Brand Voice */}
      <div className="space-y-2">
        <Label htmlFor="brand-voice">Brand Voice Description</Label>
        <Textarea
          id="brand-voice"
          placeholder="Describe your brand's voice and personality..."
          value={formState.brand_voice_description || ''}
          onChange={(e) => setBrandVoice(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>

      {/* Words to Avoid */}
      <div className="space-y-2">
        <Label>Words to Avoid</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add word..."
            value={newWordToAvoid}
            onChange={(e) => setNewWordToAvoid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWordToAvoid())}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addWordToAvoid}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {formState.words_to_avoid && formState.words_to_avoid.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {formState.words_to_avoid.map((word) => (
              <Badge
                key={word}
                variant="secondary"
                className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={() => removeWordToAvoid(word)}
              >
                {word}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Preferred Keywords */}
      <div className="space-y-2">
        <Label>Preferred Keywords</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add keyword..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addKeyword}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {formState.preferred_keywords && formState.preferred_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {formState.preferred_keywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="outline"
                className="cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700"
                onClick={() => removeKeyword(keyword)}
              >
                {keyword}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* CTA Settings */}
      <div className="space-y-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <Label htmlFor="include-cta">Include Call-to-Action</Label>
          <Switch
            id="include-cta"
            checked={formState.include_cta ?? true}
            onCheckedChange={setIncludeCTA}
          />
        </div>

        {formState.include_cta && (
          <div className="space-y-2">
            <Label htmlFor="cta-style">CTA Style</Label>
            <Select
              value={formState.cta_style || 'soft'}
              onValueChange={(v) => setCTAStyle(v as ToneSettings['cta_style'])}
            >
              <SelectTrigger id="cta-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ctaStyleOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetForm}
          disabled={!isDirty}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!isDirty || isSaving}
          size="sm"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
