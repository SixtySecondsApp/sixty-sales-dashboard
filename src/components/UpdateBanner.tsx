import { useVersionCheck } from '@/lib/hooks/useVersionCheck';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export function UpdateBanner() {
  const { updateAvailable, newBuildId, clearCachesAndReload } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if no update or user dismissed
  if (!updateAvailable || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    await clearCachesAndReload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <div>
              <p className="font-semibold">New version available!</p>
              <p className="text-sm text-emerald-100">
                Update to the latest version for the best experience.
                {newBuildId && (
                  <span className="ml-2 text-xs opacity-75">
                    Build: {newBuildId.slice(0, 20)}...
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpdate}
              size="sm"
              className="bg-white text-emerald-700 hover:bg-emerald-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Now
            </Button>
            <Button
              onClick={() => setDismissed(true)}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-emerald-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
