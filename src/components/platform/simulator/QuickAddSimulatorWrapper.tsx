/**
 * QuickAddSimulatorWrapper
 *
 * Allows platform admins to preview the Quick Add modal in V1 vs V2 without changing live settings.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuickAddComponent } from '@/components/quick-add';

type QuickAddVersion = 'v1' | 'v2';

export function QuickAddSimulatorWrapper({ defaultVersion = 'v2' }: { defaultVersion?: QuickAddVersion }) {
  const [version, setVersion] = useState<QuickAddVersion>(defaultVersion);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Version Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Quick Add Version:</span>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setVersion('v1')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                version === 'v1' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              V1 - Legacy
              {version === 'v1' && (
                <Badge variant="outline" className="text-xs ml-1">
                  Current
                </Badge>
              )}
            </button>
            <button
              onClick={() => setVersion('v2')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                version === 'v2' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              V2 - Chat
              <Badge className="text-xs ml-1 bg-violet-500/10 text-violet-500 border-violet-500/20">
                New
              </Badge>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground hidden md:block">
            {version === 'v1' ? (
              <span>Grid-based quick actions</span>
            ) : (
              <span>Chat-style quick add assistant</span>
            )}
          </div>
          <Button onClick={() => setIsOpen(true)}>Open Quick Add</Button>
        </div>
      </div>

      {/* Modal Preview */}
      <QuickAddComponent isOpen={isOpen} onClose={() => setIsOpen(false)} variant={version === 'v2' ? 'v2' : 'v1'} />
    </div>
  );
}

