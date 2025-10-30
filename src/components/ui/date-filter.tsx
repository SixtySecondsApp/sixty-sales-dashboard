import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

export type DateRangePreset = 'today' | 'thisWeek' | 'thisMonth' | 'last30Days' | 'custom' | 'all';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateFilterProps {
  value: DateRangePreset;
  customRange?: DateRange | null;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (range: DateRange | null) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

const presetOptions = [
  { value: 'all' as const, label: 'All Time' },
  { value: 'today' as const, label: 'Today' },
  { value: 'thisWeek' as const, label: 'This Week' },
  { value: 'thisMonth' as const, label: 'This Month' },
  { value: 'last30Days' as const, label: 'Last 30 Days' },
  { value: 'custom' as const, label: 'Custom Range' },
];

export function getDateRangeFromPreset(preset: DateRangePreset): DateRange | null {
  if (preset === 'all') return null;
  if (preset === 'custom') return null;
  
  const now = new Date();
  
  switch (preset) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case 'thisWeek':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'thisMonth':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case 'last30Days':
      return {
        start: startOfDay(subDays(now, 29)),
        end: endOfDay(now),
      };
    default:
      return null;
  }
}

export function DateFilter({
  value,
  customRange,
  onPresetChange,
  onCustomRangeChange,
  label = "Date Filter",
  className = "",
  compact = false
}: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(
    customRange?.start ? format(customRange.start, 'yyyy-MM-dd') : ''
  );
  const [tempEndDate, setTempEndDate] = useState(
    customRange?.end ? format(customRange.end, 'yyyy-MM-dd') : ''
  );

  // Update temp dates when customRange changes
  useEffect(() => {
    if (customRange) {
      setTempStartDate(format(customRange.start, 'yyyy-MM-dd'));
      setTempEndDate(format(customRange.end, 'yyyy-MM-dd'));
    }
  }, [customRange]);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    onPresetChange(newPreset);
    
    if (newPreset !== 'custom') {
      // Clear custom range when selecting a preset
      onCustomRangeChange(null);
      setTempStartDate('');
      setTempEndDate('');
    }
    
    if (newPreset !== 'custom') {
      setIsOpen(false);
    }
  };

  const handleCustomRangeApply = () => {
    if (!tempStartDate || !tempEndDate) {
      return;
    }
    
    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);
    
    if (start > end) {
      // Swap if start is after end
      onCustomRangeChange({
        start: startOfDay(end),
        end: endOfDay(start),
      });
    } else {
      onCustomRangeChange({
        start: startOfDay(start),
        end: endOfDay(end),
      });
    }
    
    setIsOpen(false);
  };

  const handleCustomRangeClear = () => {
    setTempStartDate('');
    setTempEndDate('');
    onCustomRangeChange(null);
    onPresetChange('all');
  };

  const getDisplayText = () => {
    if (value === 'custom' && customRange) {
      return `${format(customRange.start, 'MMM d')} - ${format(customRange.end, 'MMM d')}`;
    }
    
    const preset = presetOptions.find(option => option.value === value);
    return preset?.label || 'All Time';
  };

  const hasActiveFilter = value !== 'all';

  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`
              h-8 px-3 min-w-[140px] justify-between font-medium transition-all text-xs
              ${hasActiveFilter 
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/70' 
                : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-600'
              } ${className}
            `}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{getDisplayText()}</span>
            </div>
            
            <div className="flex items-center gap-1 ml-2">
              {hasActiveFilter && (
                <X 
                  className="w-3 h-3 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded-sm p-0.5 transition-colors" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCustomRangeClear();
                  }}
                />
              )}
              <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-xl" align="start">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <Label className="text-sm font-medium text-gray-900 dark:text-gray-200">{label}</Label>
            </div>

            <Select value={value} onValueChange={handlePresetChange}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-750 focus:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {presetOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 cursor-pointer"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {value === 'custom' && (
              <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start Date</Label>
                    <Input
                      type="date"
                      value={tempStartDate}
                      onChange={(e) => setTempStartDate(e.target.value)}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">End Date</Label>
                    <Input
                      type="date"
                      value={tempEndDate}
                      onChange={(e) => setTempEndDate(e.target.value)}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleCustomRangeApply}
                    disabled={!tempStartDate || !tempEndDate}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply Range
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCustomRangeClear}
                    className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <Label className="text-sm font-medium text-gray-900 dark:text-gray-200">{label}</Label>
      </div>

      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-750 focus:border-emerald-500 transition-colors">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          {presetOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 cursor-pointer"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === 'custom' && (
        <div className="space-y-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start Date</Label>
              <Input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">End Date</Label>
              <Input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              size="sm"
              onClick={handleCustomRangeApply}
              disabled={!tempStartDate || !tempEndDate}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Range
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCustomRangeClear}
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 