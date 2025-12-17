/**
 * AccessCodeInput Component
 * Reusable input component for access code entry with validation state
 */

import { useEffect } from 'react';
import { Check, X, Loader2, KeyRound } from 'lucide-react';

interface AccessCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  isValid: boolean | null;
  isValidating: boolean;
  error: string | null;
  onValidate: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function AccessCodeInput({
  value,
  onChange,
  isValid,
  isValidating,
  error,
  onValidate,
  disabled,
  readOnly,
  className = ''
}: AccessCodeInputProps) {
  // Auto-validate after 500ms debounce when user types
  useEffect(() => {
    if (value.length >= 4 && !readOnly && isValid === null) {
      const timer = setTimeout(() => {
        onValidate();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [value, readOnly, onValidate, isValid]);

  // Get status icon based on state
  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
    }
    if (isValid === true) {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    if (isValid === false) {
      return <X className="w-4 h-4 text-red-500" />;
    }
    return <KeyRound className="w-4 h-4 text-gray-400" />;
  };

  // Get border color based on validation state
  const getBorderClass = () => {
    if (isValid === true) return 'border-green-500 focus:border-green-500 focus:ring-green-500/20';
    if (isValid === false) return 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
    return 'border-white/20 focus:border-primary focus:ring-primary/20';
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-white/80 mb-1">
        Access Code <span className="text-red-400">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="Enter your access code"
          disabled={disabled || readOnly}
          className={`
            w-full px-4 py-3 pr-10 rounded-lg border
            bg-white/10 backdrop-blur-sm
            text-white placeholder-white/40
            uppercase tracking-wider font-mono text-sm
            transition-all duration-200
            focus:outline-none focus:ring-2
            disabled:opacity-60 disabled:cursor-not-allowed
            ${getBorderClass()}
            ${readOnly ? 'bg-white/5 cursor-not-allowed' : ''}
          `}
          onBlur={() => {
            // Validate on blur if not already validated
            if (value && isValid === null && !isValidating) {
              onValidate();
            }
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <X className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* Success message */}
      {isValid === true && !error && (
        <p className="text-sm text-green-400 flex items-center gap-1">
          <Check className="w-3 h-3" />
          {readOnly ? 'Code applied from link' : 'Valid access code'}
        </p>
      )}

      {/* Helper text when no code entered */}
      {!value && !error && (
        <p className="text-xs text-white/50">
          Don't have a code? Contact us for access.
        </p>
      )}
    </div>
  );
}

export default AccessCodeInput;
