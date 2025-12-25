/**
 * Mock Registry
 *
 * Central registry for managing integration mocks.
 * Provides lookup and management of mock configurations.
 */

import type { ProcessMapMock } from '@/lib/types/processMapTesting';
import { HubSpotMock, createHubSpotMockConfigs } from './HubSpotMock';

// ============================================================================
// Types
// ============================================================================

export interface IntegrationMockInstance {
  integration: string;
  mock: HubSpotMock; // Will be union type with other mocks
  configs: ProcessMapMock[];
}

// ============================================================================
// Mock Registry
// ============================================================================

/**
 * Central registry for managing integration mocks
 */
export class MockRegistry {
  private mocks: Map<string, ProcessMapMock[]> = new Map();
  private instances: Map<string, IntegrationMockInstance> = new Map();

  constructor(configs?: ProcessMapMock[]) {
    if (configs) {
      this.loadConfigs(configs);
    }
  }

  /**
   * Load mock configurations into the registry
   */
  loadConfigs(configs: ProcessMapMock[]): void {
    for (const config of configs) {
      const existing = this.mocks.get(config.integration) || [];
      existing.push(config);
      // Sort by priority (higher first)
      existing.sort((a, b) => b.priority - a.priority);
      this.mocks.set(config.integration, existing);
    }
  }

  /**
   * Get the best matching mock for an integration and step
   */
  getMock(integration: string, endpoint?: string): ProcessMapMock | undefined {
    const integrationMocks = this.mocks.get(integration);
    if (!integrationMocks) return undefined;

    // Find the most specific matching mock
    for (const mock of integrationMocks) {
      if (!mock.isActive) continue;

      // If mock has specific endpoint, check for match
      if (mock.endpoint && endpoint) {
        if (endpoint.toLowerCase().includes(mock.endpoint.toLowerCase())) {
          return mock;
        }
      } else if (!mock.endpoint) {
        // General mock for the integration
        return mock;
      }
    }

    return undefined;
  }

  /**
   * Get all mocks for an integration
   */
  getIntegrationMocks(integration: string): ProcessMapMock[] {
    return this.mocks.get(integration) || [];
  }

  /**
   * Get or create a mock instance for an integration
   */
  getInstance(integration: string, workflowId: string, orgId: string): IntegrationMockInstance | undefined {
    const key = `${integration}:${workflowId}`;

    if (this.instances.has(key)) {
      return this.instances.get(key);
    }

    // Create new instance based on integration type
    if (integration === 'hubspot') {
      const mock = new HubSpotMock({ preloadData: true });
      const configs = createHubSpotMockConfigs(workflowId, orgId);

      const instance: IntegrationMockInstance = {
        integration,
        mock,
        configs,
      };

      // Load configs into registry
      this.loadConfigs(configs);
      this.instances.set(key, instance);

      return instance;
    }

    // Add other integrations as they are implemented
    // if (integration === 'fathom') { ... }
    // if (integration === 'google') { ... }

    return undefined;
  }

  /**
   * Register a custom mock configuration
   */
  registerMock(config: ProcessMapMock): void {
    const existing = this.mocks.get(config.integration) || [];
    existing.push(config);
    existing.sort((a, b) => b.priority - a.priority);
    this.mocks.set(config.integration, existing);
  }

  /**
   * Remove a mock configuration
   */
  removeMock(mockId: string): void {
    for (const [integration, mocks] of this.mocks.entries()) {
      const filtered = mocks.filter(m => m.id !== mockId);
      if (filtered.length !== mocks.length) {
        this.mocks.set(integration, filtered);
        break;
      }
    }
  }

  /**
   * Check if an integration has any mocks registered
   */
  hasMocks(integration: string): boolean {
    const mocks = this.mocks.get(integration);
    return !!mocks && mocks.length > 0;
  }

  /**
   * Get all registered integrations
   */
  getIntegrations(): string[] {
    return Array.from(this.mocks.keys());
  }

  /**
   * Clear all mocks and instances
   */
  reset(): void {
    this.mocks.clear();
    for (const instance of this.instances.values()) {
      if (instance.mock instanceof HubSpotMock) {
        instance.mock.reset();
      }
    }
    this.instances.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pre-configured mock registry for testing
 */
export function createTestMockRegistry(workflowId: string, orgId: string): MockRegistry {
  const registry = new MockRegistry();

  // Initialize HubSpot mocks
  registry.getInstance('hubspot', workflowId, orgId);

  // Add other integrations as needed
  // registry.getInstance('fathom', workflowId, orgId);
  // registry.getInstance('google', workflowId, orgId);

  return registry;
}

// ============================================================================
// Exports
// ============================================================================

export { MockRegistry, createTestMockRegistry };
export type { IntegrationMockInstance };
