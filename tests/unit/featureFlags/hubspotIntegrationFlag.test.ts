import { describe, expect, it, vi } from 'vitest';

describe('isHubSpotIntegrationEnabled', () => {
  it('returns false when flag not set to true', async () => {
    vi.stubEnv('VITE_HUBSPOT_INTEGRATION_ENABLED', '');
    const mod = await import('@/lib/utils/featureFlags');
    expect(mod.isHubSpotIntegrationEnabled()).toBe(false);
  });

  it('returns true when flag set to true', async () => {
    vi.stubEnv('VITE_HUBSPOT_INTEGRATION_ENABLED', 'true');
    const mod = await import('@/lib/utils/featureFlags');
    expect(mod.isHubSpotIntegrationEnabled()).toBe(true);
  });
});

