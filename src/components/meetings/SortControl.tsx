import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface SortControlProps {
  sortField: string
  sortDirection: 'asc' | 'desc'
  onFieldChange: (field: string) => void
  onDirectionToggle: () => void
}

const SORT_OPTIONS = [
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'owner_email', label: 'Rep' },
  { value: 'meeting_start', label: 'Date' },
  { value: 'duration_minutes', label: 'Duration' },
  { value: 'sentiment_score', label: 'Sentiment' },
  { value: 'coach_rating', label: 'Coaching Score' }
]

export const SortControl: React.FC<SortControlProps> = ({
  sortField,
  sortDirection,
  onFieldChange,
  onDirectionToggle
}) => {
  const currentLabel = SORT_OPTIONS.find(opt => opt.value === sortField)?.label || 'Sort by'

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:inline">Sort:</span>
      <Select value={sortField} onValueChange={onFieldChange}>
        <SelectTrigger className="w-32 sm:w-40 h-9 text-sm bg-white/80 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-700/30">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/30">
          {SORT_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={onDirectionToggle}
        className="w-9 h-9 p-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-700/30 hover:bg-gray-100/80 dark:hover:bg-gray-800/40"
        title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
      >
        {sortDirection === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
