import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface UndoSendOptions {
  undoWindowMs?: number; // Default: 5000ms (5 seconds)
  onUndo?: () => void;
  onSendConfirmed?: () => void;
}

interface UndoSendState {
  isUndoActive: boolean;
  remainingTime: number;
  cancelSend: () => void;
}

export function useUndoSend(options: UndoSendOptions = {}) {
  const {
    undoWindowMs = 5000,
    onUndo,
    onSendConfirmed,
  } = options;

  const [isUndoActive, setIsUndoActive] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendCallbackRef = useRef<(() => Promise<void>) | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cancel the send
  const cancelSend = useCallback(() => {
    clearTimers();
    setIsUndoActive(false);
    setRemainingTime(0);
    sendCallbackRef.current = null;
    onUndo?.();
    toast.info('Send cancelled');
  }, [clearTimers, onUndo]);

  // Execute the send after undo window expires
  const executeSend = useCallback(async () => {
    if (!sendCallbackRef.current) return;

    try {
      await sendCallbackRef.current();
      onSendConfirmed?.();
    } catch (error) {
      console.error('[Undo Send] Error executing send:', error);
      toast.error('Failed to send email');
    } finally {
      clearTimers();
      setIsUndoActive(false);
      setRemainingTime(0);
      sendCallbackRef.current = null;
    }
  }, [clearTimers, onSendConfirmed]);

  // Start the undo countdown
  const startUndoWindow = useCallback((sendCallback: () => Promise<void>) => {
    // Clear any existing timers
    clearTimers();

    // Store the send callback
    sendCallbackRef.current = sendCallback;

    // Activate undo window
    setIsUndoActive(true);
    setRemainingTime(undoWindowMs);

    // Show toast with undo action
    const toastId = toast.info(
      `Email will send in ${undoWindowMs / 1000} seconds`,
      {
        action: {
          label: 'Undo',
          onClick: cancelSend,
        },
        duration: undoWindowMs,
      }
    );

    // Update remaining time every 100ms
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, undoWindowMs - elapsed);
      setRemainingTime(remaining);

      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
      }
    }, 100);

    // Execute send after undo window
    undoTimeoutRef.current = setTimeout(() => {
      toast.dismiss(toastId);
      executeSend();
    }, undoWindowMs);
  }, [undoWindowMs, clearTimers, cancelSend, executeSend]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    isUndoActive,
    remainingTime,
    startUndoWindow,
    cancelSend,
  };
}
