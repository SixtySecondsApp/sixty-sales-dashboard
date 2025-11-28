/**
 * Customer List Component
 *
 * Displays a list of all customer organizations with their subscription details
 */

import { useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { CustomerWithDetails, SubscriptionPlan, SubscriptionStatus } from '@/lib/types/saasAdmin';
import { CustomerDetailModal } from './CustomerDetailModal';

interface CustomerListProps {
  customers: CustomerWithDetails[];
  plans: SubscriptionPlan[];
  isLoading: boolean;
  onRefresh: () => void;
}

const statusConfig: Record<
  SubscriptionStatus,
  { label: string; icon: typeof CheckCircle; color: string; bgColor: string }
> = {
  active: {
    label: 'Active',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  trialing: {
    label: 'Trial',
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  past_due: {
    label: 'Past Due',
    icon: AlertCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  canceled: {
    label: 'Canceled',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
};

export function CustomerList({ customers, plans, isLoading, onRefresh }: CustomerListProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDetails | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-800"
            >
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
        <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No customers yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          When organizations sign up, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div className="col-span-4">Organization</div>
          <div className="col-span-2">Plan</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Members</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Customer Rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {customers.map((customer) => {
            const status = customer.subscription?.status || 'canceled';
            const statusInfo = statusConfig[status];
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={customer.id}
                className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => setSelectedCustomer(customer)}
              >
                {/* Organization */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {customer.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Plan */}
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    <CreditCard className="w-3 h-3" />
                    {customer.plan?.name || 'No plan'}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                      statusInfo.bgColor,
                      statusInfo.color
                    )}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.label}
                  </span>
                </div>

                {/* Members */}
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    {customer.member_count}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedCustomer(customer)}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectedCustomer(customer)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Subscription
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          plans={plans}
          onClose={() => setSelectedCustomer(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

export default CustomerList;
