import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Mail, Sparkles, Check } from 'lucide-react';
import { ModernNodeCard } from '../ModernNodeCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalesTemplateService, type SalesTemplate } from '@/lib/services/salesTemplateService';
import { toast } from 'sonner';

export function OutreachTemplateNode({ data, isSelected }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [templates, setTemplates] = useState<SalesTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(data.config?.templateId || '');
  const [generatedEmail, setGeneratedEmail] = useState<any>(null);

  useEffect(() => {
    // Load templates on mount
    SalesTemplateService.getTemplates().then(setTemplates).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template');
      return;
    }

    setIsProcessing(true);
    try {
      // Construct context from previous node outputs (payload)
      const context = {
        contact: {
          id: data.payload?.contactId || 'mock-id',
          full_name: data.payload?.contactName || 'Unknown',
          email: data.payload?.contactEmail || '',
          company_name: data.payload?.companyName || '',
          linkedin_url: data.payload?.linkedinUrl || ''
        },
        linkedin_profile: data.payload?.linkedinProfile // Rich profile data from Scrape Node
      };

      const email = await SalesTemplateService.personalizeTemplate(
        selectedTemplateId,
        context,
        { 
          skipAI: false, 
          enrichContext: true // Use smart context extraction
        }
      );

      setGeneratedEmail(email);
      data.onChange?.({ 
        ...data, 
        config: { ...data.config, templateId: selectedTemplateId },
        output: { emailDraft: email } 
      });
      toast.success('Email generated successfully');

    } catch (error) {
      toast.error('Failed to generate email');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModernNodeCard
      title="Generate Outreach Email"
      icon={Mail}
      isSelected={isSelected}
      color="green"
      status={isProcessing ? 'processing' : generatedEmail ? 'completed' : 'idle'}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500" />
      
      <div className="p-4 space-y-3">
        <div className="text-xs text-gray-500">
          Generates a hyper-personalized email using AI, templates, and scraped data.
        </div>

        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
          <SelectTrigger className="w-full bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {generatedEmail ? (
          <div className="space-y-2">
            <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
              <div className="text-xs font-medium text-green-400">Subject</div>
              <div className="text-sm text-white truncate">{generatedEmail.subject}</div>
            </div>
            {generatedEmail.ai_personalized && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Sparkles className="w-3 h-3" /> AI Personalized
              </div>
            )}
          </div>
        ) : (
          <Button 
            onClick={handleGenerate} 
            disabled={isProcessing || !selectedTemplateId}
            className="w-full bg-green-600 hover:bg-green-700"
            size="sm"
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-3 h-3 mr-2 animate-spin" />
                Writing...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-2" />
                Generate Email
              </>
            )}
          </Button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-green-500" />
    </ModernNodeCard>
  );
}





































