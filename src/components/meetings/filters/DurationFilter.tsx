import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface DurationFilterProps {
  value: 'all' | 'short' | 'medium' | 'long'
  onChange: (bucket: string) => void
}

export const DurationFilter: React.FC<DurationFilterProps> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32 sm:w-40 h-9 text-sm bg-white/80 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-700/30">
        <SelectValue placeholder="Duration" />
      </SelectTrigger>
      <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/30">
        <SelectItem value="all">All Durations</SelectItem>
        <SelectItem value="short">&lt; 30 min</SelectItem>
        <SelectItem value="medium">30-60 min</SelectItem>
        <SelectItem value="long">&gt; 60 min</SelectItem>
      </SelectContent>
    </Select>
  )
}
