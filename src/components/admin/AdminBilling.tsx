/**
 * Admin Billing Management
 *
 * Subscription management, invoices, and revenue tracking
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, Download, Eye, ChevronRight, CreditCard, Calendar, DollarSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Subscription {
  customerId: string;
  customerName: string;
  plan: 'starter' | 'pro' | 'enterprise';
  monthlyRevenue: number;
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  nextBillingDate: string;
  renewalDate: string;
}

interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  dueDate: string;
  plan: 'starter' | 'pro' | 'enterprise';
}

// Mock subscription data
const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    customerId: '1',
    customerName: 'ACME Corporation',
    plan: 'pro',
    monthlyRevenue: 2500,
    status: 'active',
    nextBillingDate: '2025-12-15',
    renewalDate: '2025-12-15',
  },
  {
    customerId: '2',
    customerName: 'TechCo Inc',
    plan: 'enterprise',
    monthlyRevenue: 5000,
    status: 'active',
    nextBillingDate: '2025-12-10',
    renewalDate: '2025-12-10',
  },
  {
    customerId: '3',
    customerName: 'Startup AI Solutions',
    plan: 'starter',
    monthlyRevenue: 0,
    status: 'paused',
    nextBillingDate: '—',
    renewalDate: '—',
  },
  {
    customerId: '4',
    customerName: 'Former Corp',
    plan: 'pro',
    monthlyRevenue: 0,
    status: 'canceled',
    nextBillingDate: '—',
    renewalDate: '—',
  },
];

// Mock invoice data
const MOCK_INVOICES: Invoice[] = [
  {
    id: 'INV-2025-001',
    customerId: '1',
    customerName: 'ACME Corporation',
    amount: 2500,
    status: 'paid',
    date: '2025-11-15',
    dueDate: '2025-11-30',
    plan: 'pro',
  },
  {
    id: 'INV-2025-002',
    customerId: '2',
    customerName: 'TechCo Inc',
    amount: 5000,
    status: 'paid',
    date: '2025-11-10',
    dueDate: '2025-11-30',
    plan: 'enterprise',
  },
  {
    id: 'INV-2025-003',
    customerId: '1',
    customerName: 'ACME Corporation',
    amount: 2500,
    status: 'pending',
    date: '2025-10-15',
    dueDate: '2025-10-30',
    plan: 'pro',
  },
  {
    id: 'INV-2025-004',
    customerId: '2',
    customerName: 'TechCo Inc',
    amount: 5000,
    status: 'failed',
    date: '2025-09-10',
    dueDate: '2025-09-30',
    plan: 'enterprise',
  },
];

const getPlanBadgeColor = (plan: string) => {
  switch (plan) {
    case 'starter':
      return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200';
    case 'pro':
      return 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-200';
    case 'enterprise':
      return 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200';
    default:
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-200';
    case 'paid':
      return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-200';
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-200';
    case 'failed':
      return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200';
    case 'past_due':
      return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200';
    case 'paused':
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
    case 'canceled':
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
  }
};

const BillingMetricCard = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
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
  </Card>
);

export default function AdminBilling() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');

  // Calculate billing metrics
  const metrics = useMemo(() => {
    const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
    const totalMRR = activeSubscriptions.reduce((sum, s) => sum + s.monthlyRevenue, 0);
    const totalPaidInvoices = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
    const pendingAmount = invoices.filter((i) => i.status === 'pending' || i.status === 'failed').reduce((sum, i) => sum + i.amount, 0);

    return {
      activeSubscriptions: activeSubscriptions.length,
      totalMRR,
      totalRevenue: totalPaidInvoices,
      pendingAmount,
    };
  }, [subscriptions, invoices]);

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const searchLower = subscriptionSearch.toLowerCase();
    return (
      sub.customerName.toLowerCase().includes(searchLower) ||
      sub.customerId.toLowerCase().includes(searchLower)
    );
  });

  const filteredInvoices = invoices.filter((inv) => {
    const searchLower = invoiceSearch.toLowerCase();
    return (
      inv.customerName.toLowerCase().includes(searchLower) ||
      inv.id.toLowerCase().includes(searchLower)
    );
  });

  const handleDownloadInvoice = (invoiceId: string) => {
    // In a real app, this would download the PDF
    console.log(`Downloading invoice: ${invoiceId}`);
  };

  const handleRetryPayment = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'pending' } : inv))
    );
  };

  return (
    <div className="space-y-6">
      {/* Billing Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BillingMetricCard
          label="Active Subscriptions"
          value={metrics.activeSubscriptions}
          icon={CreditCard}
          color="bg-blue-500"
        />
        <BillingMetricCard
          label="Monthly Recurring Revenue"
          value={`$${metrics.totalMRR.toLocaleString()}`}
          icon={DollarSign}
          color="bg-green-500"
        />
        <BillingMetricCard
          label="Total Revenue (Collected)"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="bg-purple-500"
        />
        <BillingMetricCard
          label="Pending / Failed"
          value={`$${metrics.pendingAmount.toLocaleString()}`}
          icon={Calendar}
          color="bg-orange-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800/50">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-3 font-medium text-sm ${
            activeTab === 'subscriptions'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-3 font-medium text-sm ${
            activeTab === 'invoices'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Invoices
        </button>
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Search */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by customer name or ID..."
                value={subscriptionSearch}
                onChange={(e) => setSubscriptionSearch(e.target.value)}
                className="pl-10 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
              />
            </div>
          </Card>

          {/* Subscriptions Table */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Monthly Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Next Billing
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.customerId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{sub.customerName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{sub.customerId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(sub.plan)}`}>
                          {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        ${sub.monthlyRevenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(sub.status)}`}>
                          {sub.status === 'past_due'
                            ? 'Past Due'
                            : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {sub.nextBillingDate}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="text-xl">⋯</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit Plan</DropdownMenuItem>
                            <DropdownMenuItem>Pause Subscription</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">Cancel</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Search */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by customer name or invoice ID..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="pl-10 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
              />
            </div>
          </Card>

          {/* Invoices Table */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Invoice ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{invoice.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{invoice.customerName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{invoice.date}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(invoice.plan)}`}>
                          {invoice.plan.charAt(0).toUpperCase() + invoice.plan.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        ${invoice.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(invoice.status)}`}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {invoice.dueDate}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="text-xl">⋯</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice.id)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            {(invoice.status === 'failed' || invoice.status === 'pending') && (
                              <DropdownMenuItem onClick={() => handleRetryPayment(invoice.id)}>
                                Retry Payment
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
