import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, AlertCircle, X, CheckCircle } from 'lucide-react';
import { 
  APP_VERSION, 
  isOutdatedVersion, 
  updateStoredVersion, 
  clearCacheAndReload,
  getVersionInfo 
} from '@/lib/config/version';

export function VersionManager() {
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const versionInfo = getVersionInfo();

  useEffect(() => {
    // Auto-update stored version on mount to prevent banner from showing
    updateStoredVersion();
  }, []);

  const handleClearCache = () => {
    setIsUpdating(true);
    // Give user feedback before reload
    setTimeout(() => {
      clearCacheAndReload();
    }, 1000);
  };

  const handleSoftRefresh = () => {
    updateStoredVersion();
    window.location.reload();
  };

  return (
    <>
      {/* Version Info Button (top right corner) */}
      <button
        onClick={() => setShowVersionModal(true)}
        className="fixed top-4 right-4 z-[9998] px-3 py-1.5 bg-gray-900/80 hover:bg-gray-900/90 backdrop-blur-sm text-gray-400 hover:text-white text-xs rounded-lg transition-all duration-200 border border-gray-800 hover:border-gray-700"
        title="Version info and cache management"
      >
        v{APP_VERSION}
      </button>

      {/* Version Modal */}
      <AnimatePresence>
        {showVersionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowVersionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Version & Cache Management</h3>
                    <p className="text-sm text-gray-400">Manage app updates and clear cache</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Version Info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Current Version</span>
                    <span className="text-sm font-medium text-white">{versionInfo.version}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Build Date</span>
                    <span className="text-sm font-medium text-white">
                      {new Date(versionInfo.buildDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Last Updated</span>
                    <span className="text-sm font-medium text-white">
                      {versionInfo.lastUpdated === 'Never' 
                        ? 'Never' 
                        : new Date(versionInfo.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-800/50 pt-4">
                  <h4 className="text-sm font-medium text-white mb-2">Cache Management</h4>
                  <p className="text-xs text-gray-400 mb-4">
                    If you're experiencing issues or not seeing the latest updates, you can clear your browser cache and reload the app.
                  </p>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={handleSoftRefresh}
                      className="w-full px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800/70 border border-gray-700/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Soft Refresh (Keep Session)
                    </button>

                    <button
                      onClick={handleClearCache}
                      disabled={isUpdating}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Clearing Cache...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Clear Cache & Reload
                        </>
                      )}
                    </button>

                    <p className="text-xs text-gray-500 text-center mt-2">
                      Note: Clearing cache will log you out and remove all local data
                    </p>
                  </div>
                </div>

                {/* Update Status */}
                {versionInfo.isOutdated && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Update Available</p>
                        <p className="text-xs text-gray-400 mt-1">
                          A new version is available. Click "Clear Cache & Reload" to get the latest updates.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!versionInfo.isOutdated && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-400">Up to Date</p>
                        <p className="text-xs text-gray-400 mt-1">
                          You're running the latest version of the app.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}