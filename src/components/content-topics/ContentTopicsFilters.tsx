/**
 * ContentTopicsFilters Component
 *
 * Filter bar for global topics view
 * Features:
 * - Search input with debounce
 * - Date range picker
 * - Company multi-select
 * - Contact multi-select
 * - Clear filters button
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  CalendarDays,
  Building2,
  Users,
  X,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import type { GlobalTopicsFilters } from '@/lib/services/globalTopicsService';
import { cn } from '@/lib/utils';

interface ContentTopicsFiltersProps {
  filters: GlobalTopicsFilters;
  onSearchChange: (query: string) => void;
  onDateRangeChange: (start: string | null, end: string | null) => void;
  onCompanyChange: (companyIds: string[]) => void;
  onContactChange: (contactIds: string[]) => void;
  onClearFilters: () => void;
}

export function ContentTopicsFilters({
  filters,
  onSearchChange,
  onDateRangeChange,
  onCompanyChange,
  onContactChange,
  onClearFilters,
}: ContentTopicsFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search_query || '');
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: filters.date_range?.start ? new Date(filters.date_range.start) : undefined,
    to: filters.date_range?.end ? new Date(filters.date_range.end) : undefined,
  });

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, onSearchChange]);

  // Handle date range selection
  const handleDateSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      if (range) {
        setDateRange({
          from: range.from,
          to: range.to,
        });
        if (range.from && range.to) {
          onDateRangeChange(
            format(range.from, 'yyyy-MM-dd'),
            format(range.to, 'yyyy-MM-dd')
          );
        }
      }
    },
    [onDateRangeChange]
  );

  // Clear date range
  const clearDateRange = useCallback(() => {
    setDateRange({ from: undefined, to: undefined });
    onDateRangeChange(null, null);
  }, [onDateRangeChange]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.search_query ||
    filters.date_range ||
    (filters.company_ids && filters.company_ids.length > 0) ||
    (filters.contact_ids && filters.contact_ids.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search topics..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-10 h-9"
        />
        {searchValue && (
          <button
            onClick={() => setSearchValue('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Date range picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 px-3',
              dateRange.from && 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            )}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                </>
              ) : (
                format(dateRange.from, 'MMM d, yyyy')
              )
            ) : (
              'Date Range'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Select date range</span>
              {dateRange.from && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDateRange}
                  className="h-7 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <Calendar
            mode="range"
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            className="p-3"
          />
          {/* Quick date presets */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  handleDateSelect({ from: weekAgo, to: today });
                }}
                className="h-7 text-xs"
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today);
                  monthAgo.setMonth(monthAgo.getMonth() - 1);
                  handleDateSelect({ from: monthAgo, to: today });
                }}
                className="h-7 text-xs"
              >
                Last 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const quarterAgo = new Date(today);
                  quarterAgo.setMonth(quarterAgo.getMonth() - 3);
                  handleDateSelect({ from: quarterAgo, to: today });
                }}
                className="h-7 text-xs"
              >
                Last 90 days
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Company filter placeholder - can be enhanced with actual company selector */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-9 px-3',
          filters.company_ids?.length && 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        )}
      >
        <Building2 className="w-4 h-4 mr-2" />
        Companies
        {filters.company_ids?.length ? (
          <Badge variant="secondary" className="ml-2 h-5 px-1.5">
            {filters.company_ids.length}
          </Badge>
        ) : null}
      </Button>

      {/* Contact filter placeholder - can be enhanced with actual contact selector */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-9 px-3',
          filters.contact_ids?.length && 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        )}
      >
        <Users className="w-4 h-4 mr-2" />
        Contacts
        {filters.contact_ids?.length ? (
          <Badge variant="secondary" className="ml-2 h-5 px-1.5">
            {filters.contact_ids.length}
          </Badge>
        ) : null}
      </Button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
