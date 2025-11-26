import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Shield, Save, CheckCircle, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { useNavigate } from 'react-router-dom';

// System-wide AI model configuration keys
const SYSTEM_MODEL_KEYS = [
  'ai_meeting_task_model',
  'ai_meeting_sentiment_model',
  'ai_proposal_model',
  'ai_meeting_summary_model',
  'proposal_sow_model',
  'proposal_proposal_model',
  'proposal_focus_model',
  'proposal_goals_model',
] as const;

const MODEL_LABELS: Record<string, string> = {
  'ai_meeting_task_model': 'Meeting Task Extraction',
  'ai_meeting_sentiment_model': 'Meeting Sentiment Analysis',
  'ai_proposal_model': 'Proposal Generation',
  'ai_meeting_summary_model': 'Meeting Summary',
  'proposal_sow_model': 'Proposal SOW Generation',
  'proposal_proposal_model': 'Proposal HTML Generation',
  'proposal_focus_model': 'Proposal Focus Area Analysis',
  'proposal_goals_model': 'Proposal Goals Generation',
};

const PROVIDERS = ['openai', 'anthropic', 'openrouter', 'gemini'] as const;

// Common models per provider
const MODEL_OPTIONS: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'anthropic/claude-3-5-sonnet-20241022',
    'anthropic/claude-3-5-haiku-20250514',
    'anthropic/claude-haiku-4-5-20250514',
    'anthropic/claude-3-opus-20240229',
  ],
  openrouter: [
    'anthropic/claude-3-5-sonnet-20241022',
    'anthropic/claude-3-5-haiku-20250514',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
  ],
  gemini: [
    'gemini/gemini-2.0-flash-exp',
    'gemini/gemini-1.5-pro',
    'gemini/gemini-1.5-flash',
  ],
};

interface SystemModelConfig {
  key: string;
  value: string;
  description: string | null;
  provider: string;
  model: string;
}

export default function AISettingsAdmin() {
  const { userData } = useUser();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<Record<string, SystemModelConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check admin access
    if (!userData || !isUserAdmin(userData)) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }

    loadSystemConfig();
  }, [userData, navigate]);

  const loadSystemConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .in('key', SYSTEM_MODEL_KEYS);

      if (error) throw error;

      const configMap: Record<string, SystemModelConfig> = {};
      
      SYSTEM_MODEL_KEYS.forEach(key => {
        const existing = data?.find(c => c.key === key);
        const modelValue = existing?.value || '';
        
        // Parse provider and model from value (format: "provider/model-name")
        let provider = 'anthropic';
        let model = modelValue;
        
        if (modelValue.includes('/')) {
          const parts = modelValue.split('/');
          if (parts.length >= 2) {
            provider = parts[0];
            model = parts.slice(1).join('/');
          }
        }

        configMap[key] = {
          key,
          value: modelValue,
          description: existing?.description || null,
          provider,
          model,
        };
      });

      setConfigs(configMap);
    } catch (error) {
      console.error('Error loading system config:', error);
      toast.error('Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (key: string, field: 'provider' | 'model', value: string) => {
    setConfigs(prev => {
      const current = prev[key] || { key, value: '', description: null, provider: 'anthropic', model: '' };
      
      if (field === 'provider') {
        return {
          ...prev,
          [key]: {
            ...current,
            provider: value,
            model: '', // Reset model when provider changes
          },
        };
      } else {
        const fullModelValue = value.includes('/') ? value : `${current.provider}/${value}`;
        return {
          ...prev,
          [key]: {
            ...current,
            model: value,
            value: fullModelValue,
          },
        };
      }
    });
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      
      const updates = Object.values(configs).map(config => ({
        key: config.key,
        value: config.value,
        description: MODEL_LABELS[config.key] || config.description || `System default model for ${config.key}`,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('system_config')
          .upsert(update, { onConflict: 'key' });

        if (error) {
          console.error(`Error saving ${update.key}:`, error);
          toast.error(`Failed to save ${update.key}`);
          return;
        }
      }

      toast.success('System model settings saved successfully');
    } catch (error) {
      console.error('Error saving system config:', error);
      toast.error('Failed to save system configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!userData || !isUserAdmin(userData)) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-500" />
            Admin AI Model Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configure system-wide default AI models. These settings apply to all users unless they override them in their personal settings.
          </p>
        </div>
        <Button onClick={saveConfig} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">How System Defaults Work</p>
              <p>
                These are the default models used system-wide. Users can override these in their personal settings at <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">Meetings/Settings</code>.
                The resolution order is: <strong>User Settings → System Config → Hardcoded Defaults</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {SYSTEM_MODEL_KEYS.map(key => {
          const config = configs[key];
          if (!config) return null;

          const availableModels = MODEL_OPTIONS[config.provider] || [];

          return (
            <Card key={key} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  {MODEL_LABELS[key] || key}
                </CardTitle>
                <CardDescription>
                  {config.description || `System default model for ${key}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`${key}-provider`}>Provider</Label>
                    <Select
                      value={config.provider}
                      onValueChange={(value) => updateConfig(key, 'provider', value)}
                    >
                      <SelectTrigger id={`${key}-provider`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map(provider => (
                          <SelectItem key={provider} value={provider}>
                            {provider.charAt(0).toUpperCase() + provider.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`${key}-model`}>Model</Label>
                    <Select
                      value={config.model}
                      onValueChange={(value) => updateConfig(key, 'model', value)}
                      disabled={!config.provider}
                    >
                      <SelectTrigger id={`${key}-model`}>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map(model => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Full Model Value</Label>
                  <Input
                    value={config.value}
                    readOnly
                    className="bg-gray-50 dark:bg-gray-800 font-mono text-sm"
                    placeholder={`${config.provider}/${config.model}`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This is the value stored in system_config and used as the default.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
}

