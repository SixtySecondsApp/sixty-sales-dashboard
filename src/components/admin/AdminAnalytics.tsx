/**
 * Admin Analytics Dashboard
 *
 * Displays analytics for API usage, customer growth, and revenue trends
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Users, Zap, DollarSign, Activity } from 'lucide-react';

interface AnalyticsProps {
  detailed?: boolean;
}

// Mock analytics data
const MOCK_ANALYTICS = {
  totalApiCalls: 245680,
  apiCallsGrowth: 12.5,
  activeCustomers: 147,
  customersGrowth: 8.2,
  totalTokens: 5240000,
  tokensGrowth: 23.1,
  totalRevenue: 85400,
  revenueGrowth: 15.3,
  dailyApiCalls: [
    { date: 'Nov 20', calls: 8234 },
    { date: 'Nov 21', calls: 9102 },
    { date: 'Nov 22', calls: 7845 },
    { date: 'Nov 23', calls: 10234 },
    { date: 'Nov 24', calls: 11023 },
    { date: 'Nov 25', calls: 9876 },
    { date: 'Nov 26', calls: 10102 },
  ],
  tokensByProvider: [
    { provider: 'OpenAI', tokens: 2150000, percentage: 41 },
    { provider: 'Anthropic', tokens: 1820000, percentage: 35 },
    { provider: 'Google', tokens: 890000, percentage: 17 },
    { provider: 'Other', tokens: 380000, percentage: 7 },
  ],
  revenueByPlan: [
    { plan: 'Starter', revenue: 12400, customers: 52 },
    { plan: 'Pro', revenue: 38600, customers: 43 },
    { plan: 'Enterprise', revenue: 34400, customers: 52 },
  ],
  customerGrowth: [
    { month: 'Oct', customers: 98 },
    { month: 'Nov 1-10', customers: 115 },
    { month: 'Nov 11-20', customers: 131 },
    { month: 'Nov 21-26', customers: 147 },
  ],
};

const MetricCard = ({
  label,
  value,
  trend,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  trend: number;
  icon: React.ComponentType<any>;
  color: string;
}) => (
  <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="flex items-center gap-1 mt-4">
      {trend >= 0 ? (
        <TrendingUp className="w-4 h-4 text-green-600" />
      ) : (
        <TrendingDown className="w-4 h-4 text-red-600" />
      )}
      <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {Math.abs(trend)}%
      </span>
      <span className="text-sm text-gray-600 dark:text-gray-400">vs last period</span>
    </div>
  </Card>
);

const SimpleChart = ({ data, height = 'h-48' }: { data: any[]; height?: string }) => {
  const maxValue = Math.max(...data.map((d) => d.calls || d.revenue || d.tokens || d.customers || 0));

  return (
    <div className={`flex items-end justify-between gap-2 ${height} p-4`}>
      {data.map((item, idx) => {
        const value = item.calls || item.revenue || item.tokens || item.customers || 0;
        const percentage = (value / maxValue) * 100;
        const label = item.date || item.month || item.provider || item.plan || '';

        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-lg" style={{ height: `${percentage}%` }} />
            <span className="text-xs text-gray-600 dark:text-gray-400 text-center max-w-full truncate">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const DonutChart = ({ data }: { data: any[] }) => (
  <div className="flex items-center justify-center gap-8">
    <div className="w-40 h-40 relative">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        {(() => {
          let offset = 0;
          return data.map((item, idx) => {
            const circumference = 2 * Math.PI * 45;
            const length = (item.percentage / 100) * circumference;
            const dashOffset = offset;
            offset += length;

            const colors = ['#f97316', '#a855f7', '#3b82f6', '#10b981'];

            return (
              <circle
                key={idx}
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke={colors[idx % colors.length]}
                strokeWidth="20"
                strokeDasharray={length}
                strokeDashoffset={-dashOffset}
                strokeLinecap="round"
              />
            );
          });
        })()}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {MOCK_ANALYTICS.totalTokens.toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">tokens</p>
        </div>
      </div>
    </div>
    <div className="space-y-3">
      {data.map((item, idx) => {
        const colors = ['bg-orange-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500'];
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {item.provider || item.plan}: {item.percentage}%
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

const DetailedTable = ({ title, columns, data }: { title: string; columns: string[]; data: any[] }) => (
  <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl overflow-hidden">
    <div className="p-6 border-b border-gray-200 dark:border-gray-800/50">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              {Object.values(row).map((value: any, colIdx) => (
                <td key={colIdx} className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

export default function AdminAnalytics({ detailed = false }: AnalyticsProps) {
  const [timeRange, setTimeRange] = useState('week');

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      {detailed && (
        <div className="flex gap-2">
          {['day', 'week', 'month', 'year'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range)}
              className={
                timeRange === range
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'border-gray-200 dark:border-gray-700'
              }
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
        </div>
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total API Calls"
          value={MOCK_ANALYTICS.totalApiCalls}
          trend={MOCK_ANALYTICS.apiCallsGrowth}
          icon={Zap}
          color="bg-blue-500"
        />
        <MetricCard
          label="Active Customers"
          value={MOCK_ANALYTICS.activeCustomers}
          trend={MOCK_ANALYTICS.customersGrowth}
          icon={Users}
          color="bg-green-500"
        />
        <MetricCard
          label="Tokens Used"
          value={`${(MOCK_ANALYTICS.totalTokens / 1000000).toFixed(1)}M`}
          trend={MOCK_ANALYTICS.tokensGrowth}
          icon={Activity}
          color="bg-purple-500"
        />
        <MetricCard
          label="Total Revenue"
          value={`$${MOCK_ANALYTICS.totalRevenue.toLocaleString()}`}
          trend={MOCK_ANALYTICS.revenueGrowth}
          icon={DollarSign}
          color="bg-orange-500"
        />
      </div>

      {/* Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Calls Chart */}
        <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">API Calls (Last 7 Days)</h3>
          <SimpleChart data={MOCK_ANALYTICS.dailyApiCalls} />
        </Card>

        {/* Customer Growth Chart */}
        <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Customer Growth</h3>
          <SimpleChart data={MOCK_ANALYTICS.customerGrowth} />
        </Card>
      </div>

      {/* Detailed Analytics */}
      {detailed && (
        <>
          {/* Token Usage by Provider */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-6">Token Usage by Provider</h3>
              <DonutChart data={MOCK_ANALYTICS.tokensByProvider} />
            </Card>

            <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue by Plan</h3>
              <SimpleChart data={MOCK_ANALYTICS.revenueByPlan} height="h-64" />
            </Card>
          </div>

          {/* Detailed Tables */}
          <DetailedTable
            title="Revenue by Plan (Detailed)"
            columns={['Plan', 'Revenue', 'Customers']}
            data={MOCK_ANALYTICS.revenueByPlan.map((item) => ({
              plan: item.plan,
              revenue: `$${item.revenue.toLocaleString()}`,
              customers: item.customers,
            }))}
          />

          <DetailedTable
            title="Token Usage by Provider (Detailed)"
            columns={['Provider', 'Tokens', 'Percentage']}
            data={MOCK_ANALYTICS.tokensByProvider.map((item) => ({
              provider: item.provider,
              tokens: item.tokens.toLocaleString(),
              percentage: `${item.percentage}%`,
            }))}
          />
        </>
      )}
    </div>
  );
}
