import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface SentimentFilterProps {
  value: 'all' | 'positive' | 'neutral' | 'challenging'
  onChange: (category: string) => void
}

export const SentimentFilter: React.FC<SentimentFilterProps> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32 sm:w-40 h-9 text-sm bg-white/80 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-700/30">
        <SelectValue placeholder="Sentiment" />
      </SelectTrigger>
      <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/30">
        <SelectItem value="all">All Sentiments</SelectItem>
        <SelectItem value="positive">Positive</SelectItem>
        <SelectItem value="neutral">Neutral</SelectItem>
        <SelectItem value="challenging">Challenging</SelectItem>
      </SelectContent>
    </Select>
  )
}
