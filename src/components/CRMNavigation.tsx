import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  HandHeart, 
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CRMNavigationProps {
  className?: string;
}

export function CRMNavigation({ className }: CRMNavigationProps) {
  const location = useLocation();
  
  const crmSections = [
    { 
      icon: Building2, 
      label: 'Companies', 
      href: '/crm/companies',
      description: 'Manage company profiles and relationships'
    },
    { 
      icon: Users, 
      label: 'Contacts', 
      href: '/crm/contacts',
      description: 'Individual contact management'
    },
    { 
      icon: HandHeart, 
      label: 'Deals', 
      href: '/pipeline',
      description: 'Sales opportunities and pipeline'
    }
  ];

  const getCurrentSection = () => {
    if (location.pathname.includes('/companies')) return 'Companies';
    if (location.pathname.includes('/contacts')) return 'Contacts';
    if (location.pathname.includes('/deals') || location.pathname.includes('/pipeline')) return 'Deals';
    return 'CRM';
  };

  const currentSection = getCurrentSection();

  return (
    <div className={cn("bg-gray-900/30 border-b border-gray-800/50", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* CRM Section Navigation */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-1">
            {crmSections.map((section) => {
              const isActive = location.pathname.startsWith(section.href) || 
                (section.label === 'Deals' && location.pathname.includes('/pipeline'));
              
              return (
                <Link
                  key={section.href}
                  to={section.href}
                  className="relative"
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative',
                      isActive
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                    )}
                  >
                    <section.icon className="w-4 h-4" />
                    <span>{section.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-blue-500/5 rounded-lg border border-blue-500/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {currentSection === 'Companies' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = '/crm/contacts'}
                  className="bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                >
                  <Users className="w-4 h-4 mr-1" />
                  View Contacts
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Company
                </Button>
              </>
            )}
            
            {currentSection === 'Contacts' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = '/crm/companies'}
                  className="bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  View Companies
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Contact
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CRMNavigation;