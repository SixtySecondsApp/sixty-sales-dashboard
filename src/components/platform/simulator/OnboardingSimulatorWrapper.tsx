/**
 * OnboardingSimulatorWrapper
 *
 * Provides a toggle between V1 (legacy) and V2 (skills-based) onboarding simulators.
 * Allows platform admins to preview both versions and compare experiences.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { OnboardingFlowSimulator } from './OnboardingFlowSimulator';
import { OnboardingFlowSimulatorV2 } from './OnboardingFlowSimulatorV2';

type OnboardingVersion = 'v1' | 'v2';

interface OnboardingSimulatorWrapperProps {
  defaultVersion?: OnboardingVersion;
}

export function OnboardingSimulatorWrapper({
  defaultVersion = 'v2',
}: OnboardingSimulatorWrapperProps) {
  const [version, setVersion] = useState<OnboardingVersion>(defaultVersion);

  return (
    <div className="space-y-4">
      {/* Version Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Onboarding Version:</span>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setVersion('v1')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                version === 'v1'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
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
                version === 'v2'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              V2 - Skills
              <Badge className="text-xs ml-1 bg-violet-500/10 text-violet-500 border-violet-500/20">
                New
              </Badge>
            </button>
          </div>
        </div>

        {/* Version Description */}
        <div className="text-sm text-muted-foreground">
          {version === 'v1' && (
            <span>Traditional onboarding: Team setup → Fathom connection</span>
          )}
          {version === 'v2' && (
            <span>AI-powered onboarding: Company analysis → Skills configuration</span>
          )}
        </div>
      </div>

      {/* Simulator Content */}
      {version === 'v1' ? <OnboardingFlowSimulator /> : <OnboardingFlowSimulatorV2 />}
    </div>
  );
}
