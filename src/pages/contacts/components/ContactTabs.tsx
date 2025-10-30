import React from 'react';

interface ContactTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'deals', label: 'Deals' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'emails', label: 'Emails' },
  { id: 'documents', label: 'Documents' },
];

export function ContactTabs({ activeTab, onTabChange }: ContactTabsProps) {
  return (
    <div className="mb-8 theme-border border-b overflow-x-auto">
      <nav className="flex -mb-px space-x-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              group inline-flex items-center py-4 px-6 border-b-2 text-sm whitespace-nowrap rounded-t-lg transition-all
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 font-medium'
                : 'border-transparent theme-text-tertiary hover:theme-text-primary hover:bg-gray-100/50 dark:hover:bg-gray-800/30'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
} 