import React from 'react';
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
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Company, CompanyDeal, CompanyActivity } from '@/lib/hooks/useCompany';
import { CompanyDealHealthWidget } from '@/components/CompanyDealHealthWidget';
import { DealHealthBadge } from '@/components/DealHealthBadge';
import { useDealHealthScore } from '@/lib/hooks/useDealHealth';

interface CompanyRightPanelProps {
  company: Company;
  deals: CompanyDeal[];
  activities: CompanyActivity[];
}

export function CompanyRightPanel({ company, deals, activities }: CompanyRightPanelProps) {
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

      {/* Deal Health Monitoring */}
      <CompanyDealHealthWidget companyId={company.id} />

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
    </div>
  );
}