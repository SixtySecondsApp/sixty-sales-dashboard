import { Search, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WaitlistFilters as Filters } from '@/lib/types/waitlist';

interface WaitlistFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Partial<Filters>) => void;
  onExport: () => void;
  onRefresh: () => void;
  isExporting: boolean;
}

export function WaitlistFilters({
  filters,
  onFilterChange,
  onExport,
  onRefresh,
  isExporting
}: WaitlistFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700 w-full overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Search */}
        <div className="md:col-span-2 lg:col-span-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or company..."
              value={filters.search || ''}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="pl-10 w-full"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => onFilterChange({ status: value as any })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="released">Released</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex-1 min-w-0"
          >
            <RefreshCw className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={isExporting}
            className="flex-1 min-w-0"
          >
            <Download className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{isExporting ? 'Exporting...' : 'Export'}</span>
          </Button>
        </div>
      </div>

      {/* Date Filters (Optional - expandable) */}
      <details className="mt-4 w-full">
        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          Advanced Filters
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Date
            </label>
            <Input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => onFilterChange({ date_from: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Date
            </label>
            <Input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => onFilterChange({ date_to: e.target.value })}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
