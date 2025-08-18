import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  DollarSign,
  Activity,
  Calendar,
  Globe,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertCircle,
  UserCheck,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Company, CompanyDeal, CompanyActivity, CompanyClient } from '@/lib/hooks/useCompany';

interface CompanyHeaderProps {
  company: Company;
  deals: CompanyDeal[];
  activities: CompanyActivity[];
  clients: CompanyClient[];
}

export function CompanyHeader({ company, deals, activities, clients }: CompanyHeaderProps) {
  // Calculate metrics
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const wonDeals = deals.filter(d => d.status === 'won');
  const totalWonValue = wonDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const totalMRR = wonDeals.reduce((sum, deal) => sum + (deal.monthly_mrr || 0), 0);
  const activeClients = clients.filter(c => c.status === 'active').length;
  const recentActivities = activities.filter(a => {
    const activityDate = new Date(a.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return activityDate >= thirtyDaysAgo;
  }).length;

  const getStatusColor = (status: Company['status']) => {
    switch (status) {
      case 'client':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'active':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'prospect':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'churned':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: Company['status']) => {
    switch (status) {
      case 'client':
        return CheckCircle;
      case 'active':
        return UserCheck;
      case 'prospect':
        return AlertCircle;
      case 'churned':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const StatusIcon = getStatusIcon(company.status);

  return (
    <div className="space-y-6">
      {/* Company Basic Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Company Details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{company.name}</h1>
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border",
                  getStatusColor(company.status)
                )}>
                  <StatusIcon className="w-4 h-4" />
                  {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                </div>
              </div>
              
              {company.description && (
                <p className="text-gray-400 mb-3">{company.description}</p>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {company.website && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <a 
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {company.website}
                    </a>
                  </div>
                )}
                
                {company.primary_email && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <a 
                      href={`mailto:${company.primary_email}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {company.primary_email}
                    </a>
                  </div>
                )}
                
                {company.primary_phone && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <a 
                      href={`tel:${company.primary_phone}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {company.primary_phone}
                    </a>
                  </div>
                )}
                
                {(company.city || company.country) && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{[company.city, company.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                
                {company.industry && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span>{company.industry}</span>
                  </div>
                )}
                
                {company.last_activity_date && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Last activity: {format(new Date(company.last_activity_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions/Contact */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Primary Contact</h3>
          {company.primary_contact ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs font-medium text-emerald-500">
                    {company.primary_contact.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{company.primary_contact}</div>
                  {company.primary_email && (
                    <div className="text-xs text-gray-400">{company.primary_email}</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No primary contact set</div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Deal Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-gray-400">Total Value</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(totalValue)}</div>
        </motion.div>

        {/* Won Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-gray-400">Won Value</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">{formatCurrency(totalWonValue)}</div>
        </motion.div>

        {/* Monthly MRR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-gray-400">Monthly MRR</span>
          </div>
          <div className="text-xl font-bold text-blue-400">{formatCurrency(totalMRR)}</div>
        </motion.div>

        {/* Active Deals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-400">Active Deals</span>
          </div>
          <div className="text-xl font-bold text-white">{company.active_deals_count || 0}</div>
        </motion.div>

        {/* Active Clients */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-gray-400">Active Clients</span>
          </div>
          <div className="text-xl font-bold text-white">{activeClients}</div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-medium text-gray-400">30d Activity</span>
          </div>
          <div className="text-xl font-bold text-white">{recentActivities}</div>
        </motion.div>
      </div>
    </div>
  );
}