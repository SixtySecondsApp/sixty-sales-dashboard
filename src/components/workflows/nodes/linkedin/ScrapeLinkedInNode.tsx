import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Database, RefreshCw, Download } from 'lucide-react';
import { ModernNodeCard } from '../ModernNodeCard';
import { Button } from '@/components/ui/button';
import { LinkedInEnrichmentService } from '@/lib/services/linkedinEnrichmentService';
import { toast } from 'sonner';

export function ScrapeLinkedInNode({ data, isSelected }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  const handleScrape = async () => {
    // Can get URL from previous node output or config
    const urlToScrape = data.payload?.linkedinUrl || data.config?.linkedinUrl;

    if (!urlToScrape) {
      toast.error('No LinkedIn URL provided');
      return;
    }

    setIsProcessing(true);
    try {
      const profile = await LinkedInEnrichmentService.scrapeProfile(urlToScrape);

      if (profile) {
        setProfileData(profile);
        // Update node output for next steps
        data.onChange?.({ 
          ...data, 
          output: { linkedinProfile: profile } 
        });
        toast.success('Profile scraped successfully');
      } else {
        toast.error('Failed to scrape profile');
      }
    } catch (error) {
      toast.error('Error scraping profile');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModernNodeCard
      title="Scrape LinkedIn Profile"
      icon={Database}
      isSelected={isSelected}
      color="indigo"
      status={isProcessing ? 'processing' : profileData ? 'completed' : 'idle'}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      
      <div className="p-4 space-y-3">
        <div className="text-xs text-gray-500">
          Extracts rich profile data (experience, posts, skills) using Apify.
        </div>

        {profileData ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">{profileData.fullName}</div>
            <div className="text-xs text-gray-400 truncate">{profileData.headline}</div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">
                {profileData.experience?.length || 0} Roles
              </span>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">
                {profileData.recentPosts?.length || 0} Posts
              </span>
            </div>
          </div>
        ) : (
          <Button 
            onClick={handleScrape} 
            disabled={isProcessing}
            className="w-full bg-indigo-500 hover:bg-indigo-600"
            size="sm"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Download className="w-3 h-3 mr-2" />
                Scrape Profile
              </>
            )}
          </Button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </ModernNodeCard>
  );
}











