/**
 * Admin Dashboard - SaaS Control Plane
 *
 * Main admin dashboard for managing customers, subscriptions, and usage
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import AdminCustomersList from '@/components/admin/AdminCustomersList';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import AdminApiKeys from '@/components/admin/AdminApiKeys';
import AdminBilling from '@/components/admin/AdminBilling';
import { BarChart3, Users, KeyRound, CreditCard, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeSubscriptions: 0,
    monthlyRecurringRevenue: 0,
    apiCallsToday: 0,
    loading: true
  });

  useEffect(() => {
    // Fetch dashboard stats
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // TODO: Replace with actual API call
      setStats({
        totalCustomers: 12,
        activeSubscriptions: 10,
        monthlyRecurringRevenue: 4850,
        apiCallsToday: 3452,
        loading: false
      });
    } catch (error) {
      console.error('[Admin] Failed to fetch dashboard stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-950/50 backdrop-blur-sm dark:backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage customers, subscriptions, and platform analytics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Customers */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Customers</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {stats.loading ? '--' : stats.totalCustomers}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          {/* Active Subscriptions */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {stats.loading ? '--' : stats.activeSubscriptions}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>

          {/* Monthly Recurring Revenue */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Revenue</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {stats.loading ? '--' : `$${stats.monthlyRecurringRevenue.toLocaleString()}`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>

          {/* API Calls Today */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">API Calls Today</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {stats.loading ? '--' : stats.apiCallsToday.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gray-200 dark:bg-gray-900/50 dark:border-gray-800/50 dark:backdrop-blur-xl shadow-sm">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-orange-100/30 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="data-[state=active]:bg-orange-100/30 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Customers
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="data-[state=active]:bg-orange-100/30 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Analytics
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="api-keys"
              className="data-[state=active]:bg-orange-100/30 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                API Keys
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="data-[state=active]:bg-orange-100/30 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400"
            >
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Billing
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <AdminAnalytics />
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            <AdminCustomersList />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AdminAnalytics detailed={true} />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <AdminApiKeys />
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <AdminBilling />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
