import React from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Heart, 
  Users, 
  Activity,
  FileText,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Company, CompanyDeal, CompanyActivity } from '@/lib/hooks/useCompany';

interface CompanyTabsProps {
  activeTab: 'overview' | 'deals' | 'contacts' | 'activities' | 'documents';
  onTabChange: (tab: 'overview' | 'deals' | 'contacts' | 'activities' | 'documents') => void;
  company: Company;
  deals: CompanyDeal[];
  activities: CompanyActivity[];
}

export function CompanyTabs({ activeTab, onTabChange, company, deals, activities }: CompanyTabsProps) {
  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: BarChart3,
      count: null,
      description: 'Company summary and key metrics'
    },
    {
      id: 'deals' as const,
      label: 'Deals',
      icon: Heart,
      count: deals.length,
      description: 'Sales opportunities and pipeline'
    },
    {
      id: 'contacts' as const,
      label: 'Contacts',
      icon: Users,
      count: company.primary_contact ? 1 : 0, // Will be enhanced when contacts table is available
      description: 'People and relationships'
    },
    {
      id: 'activities' as const,
      label: 'Activities',
      icon: Activity,
      count: activities.length,
      description: 'Sales activities and interactions'
    },
    {
      id: 'documents' as const,
      label: 'Documents',
      icon: FileText,
      count: 0, // Will be enhanced when document management is available
      description: 'Files and documentation'
    }
  ];

  return (
    <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
              isActive
                ? "theme-text-primary bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50"
                : "theme-text-tertiary hover:theme-text-primary hover:bg-gray-100/50 dark:hover:bg-gray-800/30"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full",
                isActive
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-300 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300"
              )}>
                {tab.count}
              </span>
            )}

            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}