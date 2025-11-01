import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import {
  Calendar,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Heart,
  AlertCircle,
  CheckCircle,
  Star,
  Plus,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Company, CompanyDeal, CompanyActivity } from '@/lib/hooks/useCompany';
import { useNextActions } from '@/lib/hooks/useNextActions';
import { NextActionBadge, NextActionPanel } from '@/components/next-actions';
import { CompanyDealHealthWidget } from '@/components/CompanyDealHealthWidget';
import { DealHealthBadge } from '@/components/DealHealthBadge';
import { useDealHealthScore } from '@/lib/hooks/useDealHealth';

interface CompanyRightPanelProps {
  company: Company;
  deals: CompanyDeal[];
  activities: CompanyActivity[];
}

export function CompanyRightPanel({ company, deals, activities }: CompanyRightPanelProps) {
  const [showNextActionsPanel, setShowNextActionsPanel] = useState(false);

  // Get AI suggestions for this company
  const {
    pendingCount: nextActionsPendingCount,
    highUrgencyCount,
    suggestions
  } = useNextActions({
    companyId: company.id,
    status: 'pending',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getRelativeTime = (date: string) => {
    const activityDate = new Date(date);
    if (isToday(activityDate)) {
      return 'Today';
    } else if (isYesterday(activityDate)) {
      return 'Yesterday';
    } else if (isThisWeek(activityDate)) {
      return format(activityDate, 'EEEE');
    } else {
      return format(activityDate, 'MMM d');
    }
  };

  // Get recent activities (last 7 days)
  const recentActivities = activities
    .filter(activity => {
      const activityDate = new Date(activity.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return activityDate >= sevenDaysAgo;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Get upcoming opportunities (in-progress deals)
  const upcomingOpportunities = deals
    .filter(deal => deal.status === 'in_progress')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 3);

  // Calculate health score (basic algorithm)
  const calculateHealthScore = () => {
    let score = 50; // Base score
    
    // Recent activity boosts score
    if (recentActivities.length > 0) score += 20;
    if (recentActivities.length > 3) score += 10;
    
    // Active deals boost score
    if (upcomingOpportunities.length > 0) score += 15;
    
    // Won deals boost score
    const wonDeals = deals.filter(d => d.status === 'won');
    if (wonDeals.length > 0) score += 15;
    if (wonDeals.length > 2) score += 10;
    
    // Cap at 100
    return Math.min(score, 100);
  };

  const healthScore = calculateHealthScore();
  
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'sale':
        return DollarSign;
      case 'meeting':
        return Calendar;
      case 'call':
        return Phone;
      case 'email':
        return Mail;
      default:
        return Activity;
    }
  };

  // Mini component to show health badge for a deal
  const DealHealthIndicator = ({ dealId }: { dealId: string }) => {
    const { healthScore } = useDealHealthScore(dealId);
    if (!healthScore) return null;
    return <DealHealthBadge healthScore={healthScore} size="sm" />;
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="theme-bg-card backdrop-blur-xl rounded-xl p-4 theme-border">
        <h3 className="text-sm font-medium theme-text-tertiary mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start bg-gray-100/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 theme-text-primary hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <Phone className="w-4 h-4 mr-2" />
            Schedule Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start bg-gray-100/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 theme-text-primary hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start bg-gray-100/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 theme-text-primary hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Deal
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start bg-gray-100/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 theme-text-primary hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <Activity className="w-4 h-4 mr-2" />
            Log Activity
          </Button>
        </div>
      </div>

      {/* AI Suggestions */}
      {nextActionsPendingCount > 0 && (
        <div className="theme-bg-card backdrop-blur-xl rounded-xl p-4 theme-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-medium theme-text-tertiary">AI Suggestions</h3>
            </div>
            <NextActionBadge
              count={nextActionsPendingCount}
              urgency={highUrgencyCount > 0 ? 'high' : 'medium'}
              onClick={() => setShowNextActionsPanel(true)}
              compact
              showIcon={false}
            />
          </div>
          <p className="text-xs theme-text-tertiary mb-3">
            {nextActionsPendingCount} AI-powered recommendation{nextActionsPendingCount !== 1 ? 's' : ''} based on recent activities
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNextActionsPanel(true)}
            className="w-full justify-start bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            View All Suggestions
          </Button>
        </div>
      )}

      {/* Deal Health Monitoring */}
      <CompanyDealHealthWidget companyId={company.id} />

      {/* Health Score */}
      <div className="theme-bg-card backdrop-blur-xl rounded-xl p-4 theme-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium theme-text-tertiary">Relationship Health</h3>
          <span className={cn("text-lg font-bold", getHealthScoreColor(healthScore))}>
            {healthScore}%
          </span>
        </div>
        <div className="w-full bg-gray-300 dark:bg-gray-800 rounded-full h-2 mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${healthScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-2 rounded-full",
              healthScore >= 80 ? "bg-emerald-500" :
              healthScore >= 60 ? "bg-yellow-500" : "bg-red-500"
            )}
          />
        </div>
        <div className="space-y-1 text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3" />
            <span>{recentActivities.length} recent activities</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3" />
            <span>{deals.filter(d => d.status === 'won').length} closed deals</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3" />
            <span>{upcomingOpportunities.length} active opportunities</span>
          </div>
        </div>
      </div>

      {/* Upcoming Opportunities */}
      <div className="theme-bg-card backdrop-blur-xl rounded-xl p-4 theme-border">
        <h3 className="text-sm font-medium theme-text-tertiary mb-3">Active Opportunities</h3>
        {upcomingOpportunities.length > 0 ? (
          <div className="space-y-3">
            {upcomingOpportunities.map((deal) => (
              <div key={deal.id} className="p-3 rounded-lg bg-gray-100/50 dark:bg-gray-800/30 border border-gray-300 dark:border-gray-700/30">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium theme-text-primary truncate">{deal.name}</h4>
                      <DealHealthIndicator dealId={deal.id} />
                    </div>
                    <div className="text-xs theme-text-tertiary">
                      Stage: {deal.stage}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Created {format(new Date(deal.created_at), 'MMM d')}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">{formatCurrency(deal.value)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-500">No active opportunities</div>
        )}
      </div>

      {/* Recent Activity Timeline */}
      <div className="theme-bg-card backdrop-blur-xl rounded-xl p-4 theme-border">
        <h3 className="text-sm font-medium theme-text-tertiary mb-3">Recent Activity</h3>
        {recentActivities.length > 0 ? (
          <div className="space-y-3">
            {recentActivities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-200/50 dark:bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium theme-text-primary capitalize">{activity.type}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-500">{getRelativeTime(activity.date)}</span>
                    </div>
                    <p className="text-xs theme-text-tertiary truncate">
                      {activity.details || 'No details available'}
                    </p>
                    {activity.amount && (
                      <p className="text-xs text-emerald-400 mt-1">{formatCurrency(activity.amount)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-500">No recent activity</div>
        )}
      </div>

      {/* Key Metrics Summary */}
      <div className="theme-bg-card backdrop-blur-xl rounded-xl p-4 theme-border">
        <h3 className="text-sm font-medium theme-text-tertiary mb-3">Key Metrics</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-sm theme-text-tertiary">Total Value</span>
            </div>
            <span className="text-sm font-medium theme-text-primary">
              {formatCurrency(company.total_deal_value || 0)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm theme-text-tertiary">Won Rate</span>
            </div>
            <span className="text-sm font-medium theme-text-primary">
              {deals.length > 0 ? Math.round((deals.filter(d => d.status === 'won').length / deals.length) * 100) : 0}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-sm theme-text-tertiary">Customer Since</span>
            </div>
            <span className="text-sm font-medium theme-text-primary">
              {format(new Date(company.created_at), 'MMM yyyy')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" />
              <span className="text-sm theme-text-tertiary">Last Contact</span>
            </div>
            <span className="text-sm font-medium theme-text-primary">
              {company.last_activity_date
                ? getRelativeTime(company.last_activity_date)
                : 'Never'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Next-Action Suggestions Panel */}
      <NextActionPanel
        companyId={company.id}
        isOpen={showNextActionsPanel}
        onClose={() => setShowNextActionsPanel(false)}
      />
    </div>
  );
}