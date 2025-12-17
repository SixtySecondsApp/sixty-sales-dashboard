/**
 * useAccessCode Hook
 * Manages access code state and validation for account signup
 */

import { useState, useEffect, useCallback } from 'react';
import { validateAccessCode, getAccessCodeFromUrl } from '../services/accessCodeService';

export interface AccessCodeState {
  code: string;
  isValid: boolean | null;
  isValidating: boolean;
  error: string | null;
  isAdminBypass: boolean;
}

export interface UseAccessCodeReturn extends AccessCodeState {
  setCode: (code: string) => void;
  validate: (codeToValidate?: string) => Promise<boolean>;
  reset: () => void;
  hasUrlCode: boolean;
}

export function useAccessCode(): UseAccessCodeReturn {
  const [code, setCodeState] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminBypass, setIsAdminBypass] = useState(false);
  const [hasUrlCode, setHasUrlCode] = useState(false);

  // Auto-populate from URL on mount
  useEffect(() => {
    const urlCode = getAccessCodeFromUrl();
    if (urlCode) {
      setCodeState(urlCode.toUpperCase());
      setHasUrlCode(true);
      // Auto-validate URL code
      validateCode(urlCode);
    }
  }, []);

  const setCode = useCallback((newCode: string) => {
    setCodeState(newCode);
    // Reset validation when code changes
    setIsValid(null);
    setError(null);
  }, []);

  const validateCode = useCallback(async (codeToValidate?: string): Promise<boolean> => {
    const c = codeToValidate ?? code;

    if (!c.trim()) {
      setIsValid(false);
      setError('Access code is required');
      return false;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await validateAccessCode(c);

      setIsValid(result.isValid);
      setError(result.error || null);
      setIsAdminBypass(result.isAdminBypass);

      // Update code to the normalized/stored version
      if (result.isValid && result.code) {
        setCodeState(result.code);
      }

      return result.isValid;
    } catch (err) {
      setIsValid(false);
      setError('Failed to validate code. Please try again.');
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [code]);

  const reset = useCallback(() => {
    setCodeState('');
    setIsValid(null);
    setIsValidating(false);
    setError(null);
    setIsAdminBypass(false);
    setHasUrlCode(false);
  }, []);

  return {
    code,
    isValid,
    isValidating,
    error,
    isAdminBypass,
    setCode,
    validate: validateCode,
    reset,
    hasUrlCode
  };
}
