import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Plus, MessageCircle, Mail, Phone, Calendar, Sparkles, ExternalLink, TrendingUp, AlertTriangle, Info, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiContactService } from '@/lib/services/apiContactService';
import type { Contact } from '@/lib/database/models';
import logger from '@/lib/utils/logger';

interface ContactRightPanelProps {
  contact: Contact;
}

export function ContactRightPanel({ contact }: ContactRightPanelProps) {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!contact.id) return;
      
      try {
        setLoading(true);
        
        // Fetch real data in parallel
        const [dealsData, activitiesData] = await Promise.all([
          ApiContactService.getContactDeals(contact.id),
          ApiContactService.getContactActivities(contact.id, 5)
        ]);
        
        setDeals(dealsData || []);
        setActivities(activitiesData || []);
      } catch (error) {
        logger.error('Error fetching right panel data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contact.id]);

  const handleDealClick = (dealId: string) => {
    // Navigate to deal detail page with return path
    navigate(`/crm/deals/${dealId}?returnTo=/crm/contacts/${contact.id}`);
  };

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'won': 
      case 'signed':
      case 'closed won': 
        return 'border-l-green-500';
      case 'signed & paid':
        return 'border-l-emerald-500';
      case 'lost':
      case 'closed lost':
        return 'border-l-red-500';
      case 'negotiation': 
      case 'negotiate': 
        return 'border-l-purple-500';
      case 'proposal': 
      case 'quote': 
        return 'border-l-blue-500';
      case 'qualified': 
      case 'discovery': 
        return 'border-l-yellow-500';
      default: 
        return 'border-l-gray-500';
    }
  };

  const getStageBadge = (stage: string) => {
    const stageKey = stage?.toLowerCase();
    switch (stageKey) {
      case 'won': 
      case 'closed won': 
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Won</Badge>;
      case 'lost':
      case 'closed lost':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Lost</Badge>;
      case 'negotiation': 
      case 'negotiate': 
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Negotiation</Badge>;
      case 'proposal': 
      case 'quote': 
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Proposal</Badge>;
      case 'qualified': 
      case 'discovery': 
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Qualified</Badge>;
      default: 
        return <Badge variant="outline">{stage || 'Unknown'}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency = '£') => {
    return `${currency}${amount?.toLocaleString() || 0}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'email': return { icon: Mail, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' };
      case 'meeting': return { icon: Calendar, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' };
      case 'call': return { icon: Phone, color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30' };
      case 'task': return { icon: MessageCircle, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' };
      default: return { icon: MessageCircle, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="section-card animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Deals */}
      <div className="section-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-blue-400" />
            Active Deals
          </h2>
          <button className="btn-sm btn-secondary">
            <Plus className="w-4 h-4" />
            <span>New Deal</span>
          </button>
        </div>

        <div className="space-y-3">
          {deals.length > 0 ? (
            deals.map((deal) => (
              <div 
                key={deal.id} 
                className={`deal-card-clickable p-4 rounded-lg bg-gray-800/50 border-l-4 ${getStageColor(deal.stage_name)} group`}
                onClick={() => handleDealClick(deal.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors">
                      {deal.title || deal.name || `Deal ${deal.id}`}
                    </h3>
                    <Eye className="w-4 h-4 text-gray-400 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  {getStageBadge(deal.stage_name)}
                </div>
                <p className="text-gray-400 text-xs mb-2">
                  {deal.description || 'No description available'}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">
                    {formatCurrency(deal.value || deal.amount)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {deal.default_probability || deal.probability || 0}% probability
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No deals found for this contact</p>
              <p className="text-xs mt-1">Create a new deal to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Communications */}
      <div className="section-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          Recent Activity
        </h2>

        <div className="space-y-3">
          {activities.length > 0 ? (
            activities.map((activity) => {
              const { icon: Icon, color, bgColor, borderColor } = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="p-3 rounded-lg bg-gray-800/50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`${bgColor} ${color} ${borderColor} text-xs`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {activity.type?.charAt(0).toUpperCase() + activity.type?.slice(1)}
                      </Badge>
                      <span className="text-white text-sm font-medium">
                        {activity.title || activity.description || `${activity.type} activity`}
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs">{formatDate(activity.created_at)}</span>
                  </div>
                  {activity.notes && (
                    <p className="text-gray-300 text-sm mb-2">{activity.notes}</p>
                  )}
                  {activity.deal_title && (
                    <p className="text-gray-400 text-xs">Related to: {activity.deal_title}</p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No recent activity found</p>
              <p className="text-xs mt-1">Activities will appear here as they happen</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="section-card bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Insights
        </h2>

        <div className="space-y-3">
          {/* Dynamic insights based on real data */}
          {deals.length > 0 && (
            <div className="p-3 rounded-lg bg-green-500/15 border border-green-500/30">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-green-400 text-xs font-medium mb-1">OPPORTUNITY</p>
                  <p className="text-white text-sm">
                    {deals.length} active deal{deals.length > 1 ? 's' : ''} worth {formatCurrency(deals.reduce((sum, deal) => sum + (deal.value || 0), 0))}. 
                    Great potential for expansion.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activities.length === 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/30">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-yellow-400 text-xs font-medium mb-1">ATTENTION</p>
                  <p className="text-white text-sm">No recent activity. Consider reaching out to maintain engagement.</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-blue-500/15 border border-blue-500/30">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-blue-400 text-xs font-medium mb-1">INSIGHT</p>
                <p className="text-white text-sm">
                  Contact shows {activities.length > 5 ? 'high' : activities.length > 2 ? 'moderate' : 'low'} engagement 
                  with {activities.length} recent activities.
                </p>
              </div>
            </div>
          </div>

          <button className="btn-outline w-full mt-4">
            <TrendingUp className="w-4 h-4" />
            <span>Generate More Insights</span>
          </button>
        </div>
      </div>
    </div>
  );
} 