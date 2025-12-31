/**
 * ContextVariablePicker Component
 *
 * Dropdown/popover for selecting context variables to insert into templates.
 * Groups variables by category and supports click-to-insert at cursor position.
 */

import { useState } from 'react';
import { Variable, ChevronDown, Search, Building2, Users, Package, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getAvailableContextVariables } from '@/lib/hooks/usePlatformSkills';

interface ContextVariablePickerProps {
  onInsert: (variable: string) => void;
}

interface VariableCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const VARIABLE_CATEGORIES: VariableCategory[] = [
  { id: 'company', label: 'Company', icon: Building2, color: 'text-blue-600 dark:text-blue-400' },
  { id: 'products', label: 'Products', icon: Package, color: 'text-purple-600 dark:text-purple-400' },
  { id: 'market', label: 'Market', icon: Target, color: 'text-green-600 dark:text-green-400' },
  { id: 'icp', label: 'ICP', icon: Users, color: 'text-orange-600 dark:text-orange-400' },
  { id: 'signals', label: 'Signals', icon: Zap, color: 'text-yellow-600 dark:text-yellow-400' },
];

// Group variables by category based on their prefix
function categorizeVariables(variables: string[]): Record<string, string[]> {
  const categorized: Record<string, string[]> = {
    company: [],
    products: [],
    market: [],
    icp: [],
    signals: [],
    other: [],
  };

  for (const variable of variables) {
    if (
      variable.startsWith('company') ||
      variable === 'domain' ||
      variable === 'tagline' ||
      variable === 'description' ||
      variable === 'industry' ||
      variable === 'employee_count' ||
      variable === 'tech_stack'
    ) {
      categorized.company.push(variable);
    } else if (
      variable.startsWith('product') ||
      variable === 'main_product' ||
      variable === 'value_propositions'
    ) {
      categorized.products.push(variable);
    } else if (
      variable.startsWith('target') ||
      variable.startsWith('competitor') ||
      variable === 'primary_competitor'
    ) {
      categorized.market.push(variable);
    } else if (variable.startsWith('icp') || variable === 'buying_signals') {
      categorized.icp.push(variable);
    } else if (variable.includes('signal') || variable.includes('trigger')) {
      categorized.signals.push(variable);
    } else {
      categorized.other.push(variable);
    }
  }

  return categorized;
}

export function ContextVariablePicker({ onInsert }: ContextVariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allVariables = getAvailableContextVariables();
  const categorizedVariables = categorizeVariables(allVariables);

  // Filter variables based on search
  const filteredCategories = VARIABLE_CATEGORIES.map((category) => {
    const variables = categorizedVariables[category.id] || [];
    const filtered = searchQuery.trim()
      ? variables.filter((v) => v.toLowerCase().includes(searchQuery.toLowerCase()))
      : variables;
    return { ...category, variables: filtered };
  }).filter((cat) => cat.variables.length > 0);

  // Also include 'other' category if it has variables
  const otherVariables = searchQuery.trim()
    ? (categorizedVariables.other || []).filter((v) =>
        v.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categorizedVariables.other || [];

  const handleInsert = (variable: string) => {
    onInsert(variable);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50"
        >
          <Variable className="w-4 h-4" />
          Insert Variable
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50"
        align="end"
      >
        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 text-sm"
            />
          </div>
        </div>

        {/* Variables List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCategories.length === 0 && otherVariables.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No variables found
            </div>
          ) : (
            <>
              {filteredCategories.map((category) => (
                <div key={category.id} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <category.icon className={cn('w-3.5 h-3.5', category.color)} />
                    {category.label}
                  </div>
                  <div className="space-y-0.5">
                    {category.variables.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => handleInsert(variable)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 rounded-md text-sm',
                          'font-mono text-gray-700 dark:text-gray-300',
                          'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                          'hover:text-indigo-700 dark:hover:text-indigo-400',
                          'transition-colors'
                        )}
                      >
                        <span className="text-indigo-600 dark:text-indigo-400">{'${'}</span>
                        {variable}
                        <span className="text-indigo-600 dark:text-indigo-400">{'}'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Other variables */}
              {otherVariables.length > 0 && (
                <div className="mb-3 last:mb-0">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <Variable className="w-3.5 h-3.5 text-gray-500" />
                    Other
                  </div>
                  <div className="space-y-0.5">
                    {otherVariables.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => handleInsert(variable)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 rounded-md text-sm',
                          'font-mono text-gray-700 dark:text-gray-300',
                          'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                          'hover:text-indigo-700 dark:hover:text-indigo-400',
                          'transition-colors'
                        )}
                      >
                        <span className="text-indigo-600 dark:text-indigo-400">{'${'}</span>
                        {variable}
                        <span className="text-indigo-600 dark:text-indigo-400">{'}'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modifiers Help */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Modifiers:</span>{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">|join(', ')</code>{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">|upper</code>{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">|lower</code>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
