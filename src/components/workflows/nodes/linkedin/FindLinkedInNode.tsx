import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Search, ExternalLink, Sparkles } from 'lucide-react';
import { ModernNodeCard } from '../ModernNodeCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LinkedInEnrichmentService } from '@/lib/services/linkedinEnrichmentService';
import { toast } from 'sonner';

export function FindLinkedInNode({ data, isSelected }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [url, setUrl] = useState(data.config?.linkedinUrl || '');

  const handleFind = async () => {
    if (!data.payload?.contactName || !data.payload?.companyName) {
      toast.error('Missing contact name or company name in payload');
      return;
    }

    setIsProcessing(true);
    try {
      const foundUrl = await LinkedInEnrichmentService.findLinkedInUrl(
        data.payload.contactName,
        data.payload.companyName
      );

      if (foundUrl) {
        setUrl(foundUrl);
        data.onChange?.({ 
          ...data, 
          config: { ...data.config, linkedinUrl: foundUrl },
          output: { linkedinUrl: foundUrl } 
        });
        toast.success('LinkedIn URL found');
      } else {
        toast.error('LinkedIn URL not found');
      }
    } catch (error) {
      toast.error('Failed to find LinkedIn URL');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModernNodeCard
      title="Find LinkedIn URL"
      icon={Search}
      isSelected={isSelected}
      color="blue"
      status={isProcessing ? 'processing' : url ? 'completed' : 'idle'}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      
      <div className="p-4 space-y-3">
        <div className="text-xs text-gray-500">
          Finds a LinkedIn profile URL using AI search based on contact details.
        </div>

        {url ? (
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <ExternalLink className="w-4 h-4 text-blue-400" />
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 truncate hover:underline">
              {url}
            </a>
          </div>
        ) : (
          <Button 
            onClick={handleFind} 
            disabled={isProcessing}
            className="w-full bg-blue-500 hover:bg-blue-600"
            size="sm"
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-3 h-3 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-3 h-3 mr-2" />
                Find URL
              </>
            )}
          </Button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </ModernNodeCard>
  );
}




