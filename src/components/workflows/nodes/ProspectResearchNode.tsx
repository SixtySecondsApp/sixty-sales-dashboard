import React, { memo, useState, useEffect } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from 'reactflow';
import { Search, Loader2, Building2, User, Briefcase, TrendingUp, Sparkles } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from './ModernNodeCard';

export interface ProspectResearchNodeData {
  prospect_name?: string;
  company_name?: string;
  website?: string;
  linkedin_url?: string;
  email?: string;
  research_summary?: string;
  interests?: string[];
  company_news?: string[];
  pain_points?: string[];
  industry?: string;
  isResearching?: boolean;
  researchError?: string;
}

const ProspectResearchNode = memo(({ id, data, selected }: NodeProps<ProspectResearchNodeData>) => {
  const [isResearching, setIsResearching] = useState(data.isResearching || false);
  const [prospectName, setProspectName] = useState(data.prospect_name || '');
  const [companyName, setCompanyName] = useState(data.company_name || '');
  const [website, setWebsite] = useState(data.website || '');
  const [linkedinUrl, setLinkedinUrl] = useState(data.linkedin_url || '');
  const [email, setEmail] = useState(data.email || '');
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setProspectName(data.prospect_name || '');
    setCompanyName(data.company_name || '');
    setWebsite(data.website || '');
    setLinkedinUrl(data.linkedin_url || '');
    setEmail(data.email || '');
    setIsResearching(data.isResearching || false);
  }, [data]);

  const updateField = (field: string, value: string) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value
              }
            }
          : node
      )
    );
  };

  const handleResearch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!prospectName && !companyName) {
      updateField('researchError', 'Please provide at least a prospect name or company name');
      return;
    }

    setIsResearching(true);
    updateField('isResearching', 'true');
    updateField('researchError', '');

    // In a real implementation, this would call an AI service or API
    // to research the prospect. For now, we'll simulate it.
    try {
      // Simulate API call - replace with actual research service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock research results - replace with actual AI research
      const mockSummary = `Research completed for ${prospectName || companyName}. Found relevant information about their industry, recent activities, and potential interests.`;
      const mockInterests = ['AI Technology', 'Sales Automation', 'Marketing Tools'];
      const mockNews = ['Company recently raised Series B funding', 'Launched new product line'];
      const mockPainPoints = ['Scaling sales team', 'Lead generation efficiency'];

      updateField('research_summary', mockSummary);
      updateField('interests', JSON.stringify(mockInterests));
      updateField('company_news', JSON.stringify(mockNews));
      updateField('pain_points', JSON.stringify(mockPainPoints));
      updateField('industry', 'Technology');
      
      setIsResearching(false);
      updateField('isResearching', 'false');
    } catch (err: any) {
      updateField('researchError', err.message || 'Research failed');
      setIsResearching(false);
      updateField('isResearching', 'false');
    }
  };

  const ResearchButton = (
    <button
      onClick={handleResearch}
      disabled={isResearching || (!prospectName && !companyName)}
      className={`p-1 rounded transition-colors ${isResearching ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10'}`}
      title="Research Prospect"
    >
      {isResearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
    </button>
  );

  const hasResearchData = data.research_summary || data.interests || data.company_news;

  return (
    <ModernNodeCard
      selected={selected}
      icon={Search}
      title="Prospect Research"
      subtitle="AI-powered research"
      color="text-blue-600 dark:text-blue-400"
      headerAction={ResearchButton}
      className="w-[360px]"
      handles={
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="summary"
            className={HANDLE_STYLES}
            style={{ top: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="interests"
            className={HANDLE_STYLES}
            style={{ top: '40%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="news"
            className={HANDLE_STYLES}
            style={{ top: '55%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="prompt_context"
            className={HANDLE_STYLES}
            style={{ top: '70%' }}
          />
        </>
      }
      handleLeft={false}
      handleRight={false}
    >
      <div className="p-0">
        {/* Input Fields */}
        <div className="p-3 space-y-2 bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Prospect Name</label>
              <input
                type="text"
                value={prospectName}
                onChange={(e) => {
                  setProspectName(e.target.value);
                  updateField('prospect_name', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-1.5 rounded border border-gray-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 focus:border-blue-500 outline-none"
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Company</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  updateField('company_name', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-1.5 rounded border border-gray-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 focus:border-blue-500 outline-none"
                placeholder="Acme Corp"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Website / LinkedIn</label>
            <input
              type="text"
              value={website || linkedinUrl}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes('linkedin.com')) {
                  setLinkedinUrl(value);
                  updateField('linkedin_url', value);
                } else {
                  setWebsite(value);
                  updateField('website', value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-1.5 rounded border border-gray-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 focus:border-blue-500 outline-none"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Research Results */}
        {hasResearchData && (
          <div className="p-3 space-y-2 bg-gray-50 dark:bg-black/20">
            {data.research_summary && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                  <Sparkles size={10} /> Summary
                </div>
                <div className="text-xs text-gray-700 dark:text-zinc-300 bg-white dark:bg-[#1e1e1e] p-2 rounded border border-gray-200 dark:border-zinc-800">
                  {data.research_summary}
                </div>
              </div>
            )}
            
            {data.interests && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                  <TrendingUp size={10} /> Interests
                </div>
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(data.interests || '[]').map((interest: string, idx: number) => (
                    <span key={idx} className="px-1.5 py-0.5 text-[9px] bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-500/20">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.company_news && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                  <Briefcase size={10} /> Recent News
                </div>
                <div className="space-y-1">
                  {JSON.parse(data.company_news || '[]').map((news: string, idx: number) => (
                    <div key={idx} className="text-[10px] text-gray-600 dark:text-zinc-400 bg-white dark:bg-[#1e1e1e] p-1.5 rounded border border-gray-200 dark:border-zinc-800">
                      {news}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {data.researchError && (
          <div className="p-3 bg-white dark:bg-[#1e1e1e]">
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {data.researchError}
            </div>
          </div>
        )}

        {/* Status */}
        <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-zinc-800">
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500">
            <span>{hasResearchData ? 'Research complete' : 'Ready to research'}</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
              AI
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

ProspectResearchNode.displayName = 'ProspectResearchNode';
export default ProspectResearchNode;

