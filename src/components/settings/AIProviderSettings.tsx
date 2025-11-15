import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, CheckCircle, AlertCircle, Sparkles, Key } from 'lucide-react';
import { AIProviderService } from '../../lib/services/aiProvider';
import { supabase } from '../../lib/supabase/clientV2';

interface APIKeyConfig {
  provider: string;
  key: string;
  isValid?: boolean;
  isVisible?: boolean;
}

export default function AIProviderSettings() {
  const [apiKeys, setApiKeys] = useState<APIKeyConfig[]>([
    { provider: 'openai', key: '', isVisible: false },
    { provider: 'anthropic', key: '', isVisible: false },
    { provider: 'openrouter', key: '', isVisible: false },
    { provider: 'gemini', key: '', isVisible: false },
  ]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [userId, setUserId] = useState<string | null>(null);

  const aiProviderService = AIProviderService.getInstance();

  useEffect(() => {
    loadExistingKeys();
  }, []);

  const loadExistingKeys = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);

      const { data, error } = await supabase
        .from('user_settings')
        .select('ai_provider_keys')
        .eq('user_id', user.id)
        .single();

      if (data?.ai_provider_keys) {
        const existingKeys = data.ai_provider_keys as Record<string, string>;
        setApiKeys(keys => keys.map(key => ({
          ...key,
          key: existingKeys[key.provider] || '',
          isValid: existingKeys[key.provider] ? true : undefined
        })));
      }
    } catch (error) {
    }
  };

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys(keys => keys.map(key => 
      key.provider === provider 
        ? { ...key, key: value, isValid: undefined }
        : key
    ));
  };

  const toggleVisibility = (provider: string) => {
    setApiKeys(keys => keys.map(key => 
      key.provider === provider 
        ? { ...key, isVisible: !key.isVisible }
        : key
    ));
  };

  const testApiKey = async (provider: string) => {
    setTesting(provider);
    try {
      const keyConfig = apiKeys.find(k => k.provider === provider);
      if (!keyConfig?.key) {
        setApiKeys(keys => keys.map(key => 
          key.provider === provider 
            ? { ...key, isValid: false }
            : key
        ));
        return;
      }

      const isValid = await aiProviderService.testApiKey(provider, keyConfig.key);
      
      setApiKeys(keys => keys.map(key => 
        key.provider === provider 
          ? { ...key, isValid }
          : key
      ));
    } catch (error) {
      setApiKeys(keys => keys.map(key => 
        key.provider === provider 
          ? { ...key, isValid: false }
          : key
      ));
    } finally {
      setTesting(null);
    }
  };

  const saveAllKeys = async () => {
    if (!userId) return;
    
    setLoading(true);
    setSaveStatus('saving');
    
    try {
      // Save each key that has a value
      for (const keyConfig of apiKeys) {
        if (keyConfig.key) {
          await aiProviderService.saveApiKey(userId, keyConfig.provider, keyConfig.key);
        }
      }
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic (Claude)';
      case 'openrouter':
        return 'OpenRouter';
      case 'gemini':
        return 'Google Gemini';
      default:
        return provider;
    }
  };

  const getProviderHelp = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'Get your API key from platform.openai.com';
      case 'anthropic':
        return 'Get your API key from console.anthropic.com';
      case 'openrouter':
        return 'Get your API key from openrouter.ai';
      case 'gemini':
        return 'Get your API key from makersuite.google.com/app/apikey';
      default:
        return '';
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">AI Provider Settings</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Configure API keys for AI models in your workflows
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {apiKeys.map((keyConfig) => (
          <div key={keyConfig.provider} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-white font-medium">{getProviderLabel(keyConfig.provider)}</h3>
                <p className="text-xs text-gray-400">{getProviderHelp(keyConfig.provider)}</p>
              </div>
              {keyConfig.isValid !== undefined && (
                <div className="flex items-center gap-2">
                  {keyConfig.isValid ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-xs ${keyConfig.isValid ? 'text-green-400' : 'text-red-400'}`}>
                    {keyConfig.isValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={keyConfig.isVisible ? 'text' : 'password'}
                  value={keyConfig.key}
                  onChange={(e) => handleKeyChange(keyConfig.provider, e.target.value)}
                  placeholder={`Enter ${getProviderLabel(keyConfig.provider)} API key`}
                  className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={() => toggleVisibility(keyConfig.provider)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-600 rounded transition-colors"
                >
                  {keyConfig.isVisible ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              
              <button
                onClick={() => testApiKey(keyConfig.provider)}
                disabled={!keyConfig.key || testing === keyConfig.provider}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
              >
                {testing === keyConfig.provider ? (
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Testing
                  </span>
                ) : (
                  'Test'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div className="text-sm text-gray-400">
          <Key className="w-4 h-4 inline mr-1" />
          API keys are encrypted and stored securely
        </div>
        
        <button
          onClick={saveAllKeys}
          disabled={loading || apiKeys.every(k => !k.key)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saveStatus === 'saving' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Saved!
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-4 h-4" />
              Error
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save API Keys
            </>
          )}
        </button>
      </div>
    </div>
  );
}