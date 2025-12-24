import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useWaitlistAdmin } from '@/lib/hooks/useWaitlistAdmin';
import { WaitlistStats } from '@/components/admin/waitlist/WaitlistStats';
import { WaitlistFilters } from '@/components/admin/waitlist/WaitlistFilters';
import { WaitlistTable } from '@/components/admin/waitlist/WaitlistTable';
import { InviteCodesManager } from '@/components/admin/waitlist/InviteCodesManager';
import { SlackNotificationSettings } from '@/components/admin/waitlist/SlackNotificationSettings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { WaitlistEntry, WaitlistFilters as Filters } from '@/lib/types/waitlist';
import type { WaitlistStats as Stats } from '@/lib/services/waitlistAdminService';

export default function WaitlistManagement() {
  const { user } = useAuth();
  const adminHook = useWaitlistAdmin(user?.id || '');

  const [stats, setStats] = useState<Stats | null>(null);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<WaitlistEntry[]>([]);
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    search: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    // Load stats
    const statsData = await adminHook.getStats();
    if (statsData) {
      setStats(statsData);
    }

    // Load all entries using pagination to bypass Supabase's 1000 row limit
    const { supabase } = await import('@/lib/supabase/clientV2');
    const pageSize = 1000;
    let allEntries: WaitlistEntry[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('meetings_waitlist')
        .select('*')
        .order('signup_position', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error loading waitlist entries:', error);
        break;
      }

      if (data && data.length > 0) {
        allEntries = allEntries.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    setEntries(allEntries);
    setFilteredEntries(allEntries);
    setIsLoading(false);
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...entries];

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => e.status === filters.status);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(e =>
        e.email.toLowerCase().includes(searchLower) ||
        e.full_name.toLowerCase().includes(searchLower) ||
        (e.company_name && e.company_name.toLowerCase().includes(searchLower))
      );
    }

    // Date filters
    if (filters.date_from) {
      filtered = filtered.filter(e => new Date(e.created_at) >= new Date(filters.date_from!));
    }

    if (filters.date_to) {
      filtered = filtered.filter(e => new Date(e.created_at) <= new Date(filters.date_to!));
    }

    setFilteredEntries(filtered);
  }, [entries, filters]);

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExport = async () => {
    await adminHook.exportCSV(filters);
  };

  const handleRefresh = () => {
    loadData();
  };

  if (!user) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 w-full">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Waitlist Management
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mt-2">
            Manage Meeting Intelligence waitlist entries, grant access, and track referrals
          </p>
        </div>

        {/* Error Alert */}
        {adminHook.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{adminHook.error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <WaitlistStats stats={stats} isLoading={isLoading} />

        {/* Invite Codes Manager */}
        <InviteCodesManager />

        {/* Slack Notification Settings */}
        <SlackNotificationSettings />

        {/* Filters */}
        <WaitlistFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onExport={handleExport}
          onRefresh={handleRefresh}
          isExporting={adminHook.loading}
        />

        {/* Table */}
        <WaitlistTable
          entries={filteredEntries}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          adminUserId={user.id}
        />
      </div>
    </div>
  );
}
