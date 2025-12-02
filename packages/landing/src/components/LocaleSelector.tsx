// packages/landing/src/components/LocaleSelector.tsx
// Locale dropdown selector for pricing section - uses portal for proper z-index

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Languages } from 'lucide-react';
import type { LocaleCode, LocaleInfo } from '../lib/services/localeService';

interface LocaleSelectorProps {
  value: LocaleCode;
  onChange: (locale: LocaleCode) => void;
  locales: LocaleInfo[];
  isLoading?: boolean;
}

export function LocaleSelector({
  value,
  onChange,
  locales,
  isLoading = false,
}: LocaleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const selectedLocale = locales.find((l) => l.code === value);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (locale: LocaleCode) => {
    onChange(locale);
    setIsOpen(false);
  };

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999,
          }}
          className="min-w-[240px] max-h-[300px] overflow-y-auto py-2 rounded-xl bg-white dark:bg-gray-900 backdrop-blur-xl border border-gray-200 dark:border-gray-700 shadow-xl"
          role="listbox"
        >
          {locales.map((locale) => (
            <button
              key={locale.code}
              onClick={() => handleSelect(locale.code)}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5
                text-left transition-colors duration-150
                ${
                  locale.code === value
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }
              `}
              role="option"
              aria-selected={locale.code === value}
            >
              <span className="text-2xl">{locale.flag}</span>
              <span className="flex-1">
                <span className="font-medium">{locale.name}</span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  {locale.currency}
                </span>
              </span>
              {locale.code === value && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-white/5 dark:bg-gray-900/80 backdrop-blur-sm
          border border-gray-200 dark:border-gray-700/50
          text-gray-900 dark:text-gray-100
          hover:bg-gray-50 dark:hover:bg-gray-800/80
          hover:border-gray-300 dark:hover:border-gray-600/50
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          min-w-[180px]
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Languages className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 text-left font-medium">
          {isLoading ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              <span className="text-xl mr-2">{selectedLocale?.flag}</span>
              <span className="text-gray-900 dark:text-white text-sm">{selectedLocale?.name}</span>
            </>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Render dropdown in a portal to escape any parent overflow/z-index issues */}
      {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export default LocaleSelector;
