import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface CoachingScoreFilterProps {
  value: 'all' | 'excellent' | 'good' | 'needs-work'
  onChange: (category: string) => void
}

export const CoachingScoreFilter: React.FC<CoachingScoreFilterProps> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32 sm:w-40 h-9 text-sm bg-white/80 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-700/30">
        <SelectValue placeholder="Coach Score" />
      </SelectTrigger>
      <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/30">
        <SelectItem value="all">All Scores</SelectItem>
        <SelectItem value="excellent">Excellent (8-10)</SelectItem>
        <SelectItem value="good">Good (6-7)</SelectItem>
        <SelectItem value="needs-work">Needs Work (0-5)</SelectItem>
      </SelectContent>
    </Select>
  )
}
