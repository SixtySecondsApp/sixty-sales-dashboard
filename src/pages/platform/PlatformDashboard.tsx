/**
 * PlatformDashboard - Platform Admin Dashboard (Tier 3)
 *
 * Unified Platform Admin hub for internal team members with is_admin flag.
 * Merges functionality from AdminDashboard + SaasAdminDashboard.
 *
 * Access: Platform Admins only (internal + is_admin)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Building2,
  CreditCard,
  BarChart3,
  Settings2,
  Shield,
  Zap,
  Sparkles,
  Code2,
  Target,
  PanelLeft,
  Workflow,
  Calendar,
  Tag,
  RefreshCw,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Activity,
  Layers,
  Globe,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import {
  getAdminDashboardStats,
  getCustomers,
} from '@/lib/services/saasAdminService';
import type { AdminDashboardStats, CustomerWithDetails } from '@/lib/types/saasAdmin';
import { toast } from 'sonner';
import MeetingsWaitlist from './MeetingsWaitlist';

interface PlatformSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  badge?: string;
}

const platformSections: Record<string, PlatformSection[]> = {
  'Customer Management': [
    {
      id: 'customers',
      title: 'Customers',
      description: 'Manage organizations, subscriptions, and customer details',
      icon: Building2,
      href: '/platform/customers',
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    },
    {
      id: 'plans',
      title: 'Subscription Plans',
      description: 'Configure pricing tiers, features, and usage limits',
      icon: CreditCard,
      href: '/platform/plans',
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'View all users, manage permissions, and admin access',
      icon: Users,
      href: '/platform/users',
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    },
  ],
  'CRM Configuration': [
    {
      id: 'pipeline',
      title: 'Pipeline Settings',
      description: 'Configure sales pipeline stages and automation rules',
      icon: PanelLeft,
      href: '/platform/crm/pipeline',
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    },
    {
      id: 'smart-tasks',
      title: 'Smart Tasks',
      description: 'Manage automated task templates and intelligent triggers',
      icon: Zap,
      href: '/platform/crm/smart-tasks',
      color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      id: 'pipeline-automation',
      title: 'Pipeline Automation',
      description: 'Set up automated transitions and workflow rules',
      icon: Workflow,
      href: '/platform/crm/automation',
      color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30',
    },
  ],
  'AI & Intelligence': [
    {
      id: 'ai-settings',
      title: 'AI Configuration',
      description: 'Configure AI providers, models, and intelligent features',
      icon: Sparkles,
      href: '/platform/ai/settings',
      color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30',
    },
    {
      id: 'ai-prompts',
      title: 'AI Prompts',
      description: 'Customize prompt templates for analysis and generation',
      icon: Layers,
      href: '/platform/ai/prompts',
      color: 'text-fuchsia-600 bg-fuchsia-100 dark:bg-fuchsia-900/30',
    },
    {
      id: 'feature-flags',
      title: 'Feature Flags',
      description: 'Control feature availability per customer',
      icon: Settings2,
      href: '/platform/features',
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
    },
  ],
  'Integrations': [
    {
      id: 'google-integration',
      title: 'Google Integration',
      description: 'Test Calendar, Gmail, and OAuth integrations',
      icon: Globe,
      href: '/platform/integrations/google',
      color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    },
    {
      id: 'savvycal',
      title: 'SavvyCal Sources',
      description: 'Map booking link IDs to lead sources',
      icon: Calendar,
      href: '/platform/integrations/savvycal',
      color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30',
    },
    {
      id: 'booking-sources',
      title: 'Booking Sources',
      description: 'Manage predefined booking source mappings',
      icon: Tag,
      href: '/platform/integrations/booking-sources',
      color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30',
    },
  ],
  'Security & Audit': [
    {
      id: 'audit',
      title: 'Audit Logs',
      description: 'View system activity, user actions, and security events',
      icon: Shield,
      href: '/platform/audit',
      color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
    },
    {
      id: 'usage',
      title: 'Usage Analytics',
      description: 'Track resource consumption and usage patterns',
      icon: BarChart3,
      href: '/platform/usage',
      color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    },
  ],
  'Development Tools': [
    {
      id: 'api-testing',
      title: 'API Testing',
      description: 'Test API endpoints and debug issues',
      icon: Code2,
      href: '/platform/dev/api-testing',
      color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30',
    },
    {
      id: 'function-testing',
      title: 'Function Testing',
      description: 'Test edge functions and serverless endpoints',
      icon: Target,
      href: '/platform/dev/function-testing',
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
    },
    {
      id: 'onboarding-simulator',
      title: 'Onboarding Simulator',
      description: 'Simulate and visualize the free trial journey',
      icon: Calendar,
      href: '/platform/onboarding-simulator',
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    },
  ],
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useUserPermissions();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [statsData, customersData] = await Promise.all([
        getAdminDashboardStats(),
        getCustomers(),
      ]);
      setStats(statsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading platform data:', error);
      toast.error('Failed to load platform data');
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      label: 'Total Customers',
      value: stats?.total_customers || 0,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Active Subscriptions',
      value: stats?.active_subscriptions || 0,
      icon: Users,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Monthly Recurring Revenue',
      value: formatCurrency(stats?.total_mrr || 0),
      icon: DollarSign,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Annual Recurring Revenue',
      value: formatCurrency(stats?.total_arr || 0),
      icon: TrendingUp,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Platform Administration
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage customers, configuration, and system settings
              </p>
            </div>
            <Badge variant="outline" className="ml-4 bg-purple-500/10 text-purple-600 border-purple-500/30">
              <Shield className="w-3 h-3 mr-1" />
              Platform Admin
            </Badge>
          </div>
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="waitlist"
              className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400"
            >
              <Users className="w-4 h-4 mr-2" />
              Waitlist Admin
              <Badge variant="outline" className="ml-2 text-xs">New</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8 mt-0">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="border-gray-200 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {isLoading ? (
                          <span className="inline-block w-16 h-7 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                        ) : (
                          stat.value
                        )}
                      </p>
                    </div>
                    <div className={cn('p-3 rounded-xl', stat.bgColor)}>
                      <stat.icon className={cn('w-5 h-5', stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

            {/* Section Cards */}
            <div className="space-y-8">
          {Object.entries(platformSections).map(([sectionTitle, items], sectionIndex) => (
            <motion.div
              key={sectionTitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + sectionIndex * 0.1 }}
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {sectionTitle}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 group"
                    onClick={() => navigate(item.href)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={cn('p-3 rounded-xl', item.color)}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                      <CardTitle className="text-base mt-3">{item.title}</CardTitle>
                      <CardDescription className="text-sm">{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
            </div>

            {/* Recent Customers Preview */}
            {customers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="mt-8"
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Customers</CardTitle>
                      <CardDescription>Latest organizations on the platform</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/platform/customers')}>
                      View All
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {customers.slice(0, 5).map((customer) => (
                        <div
                          key={customer.id}
                          className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {customer.plan?.name || 'No plan'} • {customer.member_count} members
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {customer.subscription_status || 'Unknown'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* Waitlist Admin Tab */}
          <TabsContent value="waitlist" className="mt-0">
            <MeetingsWaitlist />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
