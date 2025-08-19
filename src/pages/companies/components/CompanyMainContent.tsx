import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  BarChart3, 
  Handshake, 
  Users, 
  Activity,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Star,
  Building2,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Company, CompanyDeal, CompanyActivity, CompanyClient } from '@/lib/hooks/useCompany';

interface CompanyMainContentProps {
  activeTab: 'overview' | 'deals' | 'contacts' | 'activities' | 'documents';
  company: Company;
  deals: CompanyDeal[];
  activities: CompanyActivity[];
  clients: CompanyClient[];
}

export function CompanyMainContent({ 
  activeTab, 
  company, 
  deals, 
  activities, 
  clients 
}: CompanyMainContentProps) {
  const navigate = useNavigate();
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getDealStatusColor = (status: CompanyDeal['status']) => {
    switch (status) {
      case 'won':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'in_progress':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'lost':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getDealStatusIcon = (status: CompanyDeal['status']) => {
    switch (status) {
      case 'won':
        return CheckCircle;
      case 'in_progress':
        return Clock;
      case 'lost':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  const getActivityTypeIcon = (type: string) => {
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

  const renderOverview = () => (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-medium text-gray-400">Revenue Overview</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total Deals</span>
              <span className="text-sm font-medium text-white">{formatCurrency(company.total_deal_value || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Won Deals</span>
              <span className="text-sm font-medium text-emerald-400">
                {formatCurrency(deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.value, 0))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Monthly MRR</span>
              <span className="text-sm font-medium text-blue-400">
                {formatCurrency(deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.monthly_mrr || 0), 0))}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
          <div className="flex items-center gap-3 mb-4">
            <Handshake className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-medium text-gray-400">Deal Pipeline</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total Deals</span>
              <span className="text-sm font-medium text-white">{deals.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Won</span>
              <span className="text-sm font-medium text-emerald-400">{deals.filter(d => d.status === 'won').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">In Progress</span>
              <span className="text-sm font-medium text-blue-400">{deals.filter(d => d.status === 'in_progress').length}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-medium text-gray-400">Activity Summary</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total Activities</span>
              <span className="text-sm font-medium text-white">{activities.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Sales Activities</span>
              <span className="text-sm font-medium text-emerald-400">{activities.filter(a => a.type === 'sale').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Last 30 Days</span>
              <span className="text-sm font-medium text-blue-400">
                {activities.filter(a => {
                  const activityDate = new Date(a.date);
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return activityDate >= thirtyDaysAgo;
                }).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50">
        <div className="p-6 border-b border-gray-800/50">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="p-6">
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.slice(0, 5).map((activity, index) => {
                const Icon = getActivityTypeIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/30">
                    <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white capitalize">{activity.type}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">{format(new Date(activity.date), 'MMM d, yyyy')}</span>
                      </div>
                      <p className="text-sm text-gray-400">{activity.details || 'No details available'}</p>
                      {activity.amount && (
                        <p className="text-sm text-emerald-400 mt-1">{formatCurrency(activity.amount)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No activities found for this company.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderDeals = () => (
    <motion.div
      key="deals"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50">
        <div className="p-6 border-b border-gray-800/50">
          <h3 className="text-lg font-semibold text-white">Deals ({deals.length})</h3>
        </div>
        <div className="p-6">
          {deals.length > 0 ? (
            <div className="space-y-4">
              {deals.map((deal) => {
                const StatusIcon = getDealStatusIcon(deal.status);
                return (
                  <div 
                    key={deal.id} 
                    className="p-4 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:border-gray-600/50 hover:bg-gray-800/50 transition-all cursor-pointer group"
                    onClick={() => navigate(`/crm/deals/${deal.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">{deal.name}</h4>
                          <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" />
                        </div>
                        <p className="text-sm text-gray-400">Stage: {deal.stage}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-white mb-1">{formatCurrency(deal.value)}</div>
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                          getDealStatusColor(deal.status)
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {deal.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {deal.monthly_mrr && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Monthly MRR:</span>
                          <span className="text-blue-400 font-medium">{formatCurrency(deal.monthly_mrr)}</span>
                        </div>
                      )}
                      {deal.one_off_revenue && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">One-off:</span>
                          <span className="text-emerald-400 font-medium">{formatCurrency(deal.one_off_revenue)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Created:</span>
                        <span className="text-white">{format(new Date(deal.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No deals found for this company.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderActivities = () => (
    <motion.div
      key="activities"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50">
        <div className="p-6 border-b border-gray-800/50">
          <h3 className="text-lg font-semibold text-white">Activities ({activities.length})</h3>
        </div>
        <div className="p-6">
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => {
                const Icon = getActivityTypeIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start gap-4 p-4 rounded-lg bg-gray-800/30">
                    <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base font-medium text-white capitalize">{activity.type}</span>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="text-sm text-gray-400">{format(new Date(activity.date), 'MMM d, yyyy HH:mm')}</span>
                        {activity.sales_rep && (
                          <>
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-sm text-blue-400">{activity.sales_rep}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{activity.details || 'No details available'}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          activity.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        )}>
                          {activity.status}
                        </span>
                        {activity.amount && (
                          <span className="text-emerald-400 font-medium">{formatCurrency(activity.amount)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No activities found for this company.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderContacts = () => (
    <motion.div
      key="contacts"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50">
        <div className="p-6 border-b border-gray-800/50">
          <h3 className="text-lg font-semibold text-white">Contacts</h3>
        </div>
        <div className="p-6">
          {company.primary_contact ? (
            <div 
              className="p-4 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:border-gray-600/50 hover:bg-gray-800/50 transition-all cursor-pointer group"
              onClick={() => navigate(`/crm/contacts?search=${encodeURIComponent(company.primary_contact || '')}`)}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-emerald-500">
                    {company.primary_contact.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-medium text-white mb-1 group-hover:text-emerald-400 transition-colors">{company.primary_contact}</h4>
                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm text-gray-400 mb-3">Primary Contact • Click to view in contacts</p>
                  <div className="space-y-2">
                    {company.primary_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <a 
                          href={`mailto:${company.primary_email}`}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.primary_email}
                        </a>
                      </div>
                    )}
                    {company.primary_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <a 
                          href={`tel:${company.primary_phone}`}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.primary_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No contacts found for this company.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderDocuments = () => (
    <motion.div
      key="documents"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50">
        <div className="p-6 border-b border-gray-800/50">
          <h3 className="text-lg font-semibold text-white">Documents</h3>
        </div>
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            Document management coming soon.
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'deals':
        return renderDeals();
      case 'contacts':
        return renderContacts();
      case 'activities':
        return renderActivities();
      case 'documents':
        return renderDocuments();
      default:
        return renderOverview();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {renderContent()}
    </AnimatePresence>
  );
}