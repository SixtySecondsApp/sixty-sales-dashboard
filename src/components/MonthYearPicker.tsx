import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { format, setMonth, setYear } from 'date-fns'
import { Calendar } from 'lucide-react'

interface MonthYearPickerProps {
  value: Date
  onChange: (date: Date) => void
  maxDate?: Date
  minDate?: Date
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function MonthYearPicker({ value, onChange, maxDate, minDate }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempMonth, setTempMonth] = useState(value.getMonth().toString())
  const [tempYear, setTempYear] = useState(value.getFullYear().toString())

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 9 + i)

  const handleApply = () => {
    const newDate = setMonth(setYear(value, parseInt(tempYear)), parseInt(tempMonth))

    // Validate against min/max dates
    if (maxDate && newDate > maxDate) {
      return
    }
    if (minDate && newDate < minDate) {
      return
    }

    onChange(newDate)
    setIsOpen(false)
  }

  const handleReset = () => {
    setTempMonth(value.getMonth().toString())
    setTempYear(value.getFullYear().toString())
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
          title="Click to change month/year"
        >
          <Calendar className="w-4 h-4 text-[#64748B] dark:text-gray-400" />
          <span className="text-sm font-medium text-[#1E293B] dark:text-white">
            {format(value, 'MMMM yyyy')}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-medium text-gray-900 dark:text-white">Select Month & Year</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Month Selector */}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-2">
                Month
              </label>
              <Select value={tempMonth} onValueChange={setTempMonth}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {MONTHS.map((month, index) => (
                    <SelectItem
                      key={month}
                      value={index.toString()}
                      className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors focus:bg-emerald-50 dark:focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300"
                    >
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year Selector */}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-2">
                Year
              </label>
              <Select value={tempYear} onValueChange={setTempYear}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {years.map((year) => (
                    <SelectItem
                      key={year}
                      value={year.toString()}
                      className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors focus:bg-emerald-50 dark:focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300"
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">Preview:</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {MONTHS[parseInt(tempMonth)]} {tempYear}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex-1 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={maxDate && new Date(parseInt(tempYear), parseInt(tempMonth)) > maxDate}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
