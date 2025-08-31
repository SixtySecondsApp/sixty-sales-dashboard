import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building2,
  Users,
  Heart,
  DollarSign,
  TrendingUp,
  Target
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  contactCount?: number;
  dealsCount?: number;
  dealsValue?: number;
}

interface QuickStatsBarProps {
  companies: Company[];
}

const QuickStatsBar: React.FC<QuickStatsBarProps> = ({ companies }) => {
  // Calculate aggregated stats
  const totalCompanies = companies.length;
  const totalContacts = companies.reduce((sum, company) => sum + (company.contactCount || 0), 0);
  const activeDeals = companies.reduce((sum, company) => sum + (company.dealsCount || 0), 0);
  const totalValue = companies.reduce((sum, company) => sum + (company.dealsValue || 0), 0);
  
  // Calculate average deal size
  const averageDealSize = activeDeals > 0 ? totalValue / activeDeals : 0;
  
  // Calculate conversion rate (mock for MVP)
  const conversionRate = totalCompanies > 0 ? Math.round((activeDeals / totalCompanies) * 100) : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
      notation: value > 999999 ? 'compact' : 'standard'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      notation: value > 999 ? 'compact' : 'standard',
      maximumFractionDigits: 1
    }).format(value);
  };

  const stats = [
    {
      label: 'Total Companies',
      value: formatNumber(totalCompanies),
      change: '+12%',
      icon: Building2,
      color: 'emerald',
    },
    {
      label: 'Total Contacts',
      value: formatNumber(totalContacts),
      change: '+23%',
      icon: Users,
      color: 'blue',
    },
    {
      label: 'Active Deals',
      value: formatNumber(activeDeals),
      change: '+8%',
      icon: Heart,
      color: 'purple',
    },
    {
      label: 'Total Value',
      value: formatCurrency(totalValue),
      change: '+15%',
      icon: DollarSign,
      color: 'green',
    },
    {
      label: 'Avg Deal Size',
      value: formatCurrency(averageDealSize),
      change: '+5%',
      icon: TrendingUp,
      color: 'orange',
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      change: '+3%',
      icon: Target,
      color: 'pink',
    },
  ];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
      purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
      green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
      orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
      pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
    };
    return colorMap[color] || colorMap.emerald;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {stats.map((stat, idx) => {
        const colors = getColorClasses(stat.color);
        
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 hover:border-gray-700/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${colors.bg} border ${colors.border}`}>
                <stat.icon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <span className="text-xs font-medium text-emerald-400">
                {stat.change}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stat.value}
              </div>
              <div className="text-xs text-gray-400">
                {stat.label}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default QuickStatsBar;