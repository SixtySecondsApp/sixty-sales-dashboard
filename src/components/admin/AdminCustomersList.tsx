/**
 * Admin Customers List
 *
 * Displays all provisioned customers with search, filtering, and management actions
 */

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, ChevronDown, MoreVertical, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock data - will be replaced with API calls
const MOCK_CUSTOMERS = [
  {
    id: '1',
    name: 'ACME Corporation',
    email: 'admin@acme.com',
    domain: 'acme-corp',
    plan: 'pro' as const,
    status: 'active' as const,
    modules: 4,
    monthlyRevenue: 2500,
    createdAt: '2025-11-15',
  },
  {
    id: '2',
    name: 'TechCo Inc',
    email: 'billing@techco.com',
    domain: 'techco-inc',
    plan: 'enterprise' as const,
    status: 'active' as const,
    modules: 7,
    monthlyRevenue: 5000,
    createdAt: '2025-11-10',
  },
  {
    id: '3',
    name: 'Startup AI Solutions',
    email: 'founders@startup-ai.com',
    domain: 'startup-ai',
    plan: 'starter' as const,
    status: 'trial' as const,
    modules: 2,
    monthlyRevenue: 0,
    createdAt: '2025-11-20',
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
    case 'trial':
      return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-200';
    case 'suspended':
      return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200';
    case 'canceled':
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
  }
};

interface Customer {
  id: string;
  name: string;
  email: string;
  domain: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'canceled';
  modules: number;
  monthlyRevenue: number;
  createdAt: string;
}

export default function AdminCustomersList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'revenue' | 'created'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Simulate API call to fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      setCustomers(MOCK_CUSTOMERS);
      setLoading(false);
    };

    fetchCustomers();
  }, []);

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers.filter((customer) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        customer.domain.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Plan filter
      if (selectedPlan !== 'all' && customer.plan !== selectedPlan) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && customer.status !== selectedStatus) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [customers, searchTerm, selectedPlan, selectedStatus, sortBy, sortOrder]);

  const handleActionClick = (action: string, customer: Customer) => {
    console.log(`Action: ${action} on customer: ${customer.name}`);
    // TODO: Implement modal or navigation
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, company, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Plan Filters */}
            <div className="flex gap-2">
              <Button
                variant={selectedPlan === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlan('all')}
                className={
                  selectedPlan === 'all'
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                All Plans
              </Button>
              <Button
                variant={selectedPlan === 'starter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlan('starter')}
                className={
                  selectedPlan === 'starter'
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                Starter
              </Button>
              <Button
                variant={selectedPlan === 'pro' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlan('pro')}
                className={
                  selectedPlan === 'pro'
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                Pro
              </Button>
              <Button
                variant={selectedPlan === 'enterprise' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlan('enterprise')}
                className={
                  selectedPlan === 'enterprise'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                Enterprise
              </Button>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2">
              <Button
                variant={selectedStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('all')}
                className={
                  selectedStatus === 'all'
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                All Status
              </Button>
              <Button
                variant={selectedStatus === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('active')}
                className={
                  selectedStatus === 'active'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                Active
              </Button>
              <Button
                variant={selectedStatus === 'trial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('trial')}
                className={
                  selectedStatus === 'trial'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'border-gray-200 dark:border-gray-700'
                }
              >
                Trial
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredCustomers.length}</span> of{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{customers.length}</span> customers
        </p>
      </div>

      {/* Table */}
      <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No customers found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Modules
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Monthly Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{customer.domain}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{customer.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(customer.plan)}`}>
                        {customer.plan.charAt(0).toUpperCase() + customer.plan.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(customer.status)}`}>
                        {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{customer.modules}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${customer.monthlyRevenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{customer.createdAt}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleActionClick('details', customer)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleActionClick('modules', customer)}>
                            Manage Modules
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleActionClick('suspend', customer)} className="text-red-600">
                            Suspend Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
