import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  DollarSign,
  Edit,
  Star,
  StarOff,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContactCompanyGraph } from '@/lib/hooks/useContactCompanyGraph';
import type { Company } from '@/lib/database/models';

interface CompanySidebarProps {
  company: Company;
  collapsed: boolean;
  onToggle: () => void;
  graph?: ContactCompanyGraph;
}

export function CompanySidebar({ company, collapsed, onToggle }: CompanySidebarProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const quickStats = [
    {
      label: 'Total Value',
      value: formatCurrency(company.total_deal_value || 0),
      icon: DollarSign,
      color: 'text-emerald-400'
    },
    {
      label: 'Active Deals',
      value: company.active_deals_count || 0,
      icon: TrendingUp,
      color: 'text-blue-400'
    },
    {
      label: 'Activities',
      value: company.total_activities_count || 0,
      icon: Activity,
      color: 'text-purple-400'
    }
  ];

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 60 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="theme-bg-card backdrop-blur-xl rounded-xl theme-border h-fit sticky top-6"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800/50">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h3 className="text-sm font-medium theme-text-tertiary">Company Info</h3>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 theme-text-tertiary" />
            ) : (
              <ChevronLeft className="w-4 h-4 theme-text-tertiary" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {!collapsed ? (
          <>
            {/* Company Status */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">Status</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm theme-text-tertiary">Type</span>
                  <span className="text-sm theme-text-primary capitalize">{company.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm theme-text-tertiary">Created</span>
                  <span className="text-sm theme-text-primary">
                    {format(new Date(company.created_at), 'MMM yyyy')}
                  </span>
                </div>
                {company.last_activity_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm theme-text-tertiary">Last Activity</span>
                    <span className="text-sm theme-text-primary">
                      {format(new Date(company.last_activity_date), 'MMM d')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">Quick Stats</h4>
              <div className="space-y-2">
                {quickStats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-gray-100/50 dark:bg-gray-800/30">
                      <Icon className={cn("w-4 h-4", stat.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs theme-text-tertiary">{stat.label}</div>
                        <div className="text-sm font-medium theme-text-primary truncate">{stat.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Company Details */}
            {(company.industry || company.size || company.website) && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">Details</h4>
                <div className="space-y-2">
                  {company.industry && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm theme-text-tertiary">Industry</span>
                      <span className="text-sm theme-text-primary text-right truncate ml-2">{company.industry}</span>
                    </div>
                  )}
                  {company.size && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm theme-text-tertiary">Size</span>
                      <span className="text-sm theme-text-primary">{company.size}</span>
                    </div>
                  )}
                  {company.website && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm theme-text-tertiary">Website</span>
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors truncate ml-2"
                      >
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">Actions</h4>
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start theme-text-tertiary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800/50"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Company
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start theme-text-tertiary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800/50"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start theme-text-tertiary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800/50"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Log Activity
                </Button>
              </div>
            </div>

            {/* Tags/Notes (Placeholder) */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">Notes</h4>
              <div className="text-sm text-gray-500 dark:text-gray-500 italic">
                No notes available
              </div>
            </div>
          </>
        ) : (
          // Collapsed view - just icons
          <div className="space-y-4">
            {quickStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="flex items-center justify-center p-2 rounded-lg bg-gray-100/50 dark:bg-gray-800/30"
                  title={`${stat.label}: ${stat.value}`}
                >
                  <Icon className={cn("w-4 h-4", stat.color)} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}