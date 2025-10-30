import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const bellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications({ limit: 20 });

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bellRef.current &&
        panelRef.current &&
        !bellRef.current.contains(event.target as Node) &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  // Calculate panel position when opening
  const handleToggle = () => {
    if (!isOpen && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      // Position the panel to the right of the bell icon with some offset
      setPanelPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width + 8
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Notification Bell */}
      <div ref={bellRef} className="relative">
        <button
          onClick={handleToggle}
          className={cn(
            "relative p-2 rounded-lg transition-all duration-200",
            "hover:bg-gray-50 dark:hover:bg-gray-800/30 hover:scale-110",
            isOpen && "bg-gray-100 dark:bg-gray-800/50 scale-110"
          )}
          aria-label="Notifications"
          aria-expanded={isOpen}
        >
          <Bell className="w-5 h-5 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" />
          
          {/* Unread Count Badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
                
                {/* Pulse animation for new notifications */}
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Notification Panel - Rendered as Portal */}
      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[200]"
            style={{
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`,
            }}
          >
            <NotificationPanel onClose={() => setIsOpen(false)} />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}