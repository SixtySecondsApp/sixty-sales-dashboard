/**
 * Mock Registry
 *
 * Central registry for managing integration mocks.
 * Provides lookup and management of mock configurations.
 */

import type { ProcessMapMock } from '@/lib/types/processMapTesting';
import { HubSpotMock, createHubSpotMockConfigs } from './HubSpotMock';
import { FathomMock, createFathomMockConfigs } from './FathomMock';
import { GoogleMock, createGoogleMockConfigs } from './GoogleMock';
import { SlackMock, createSlackMockConfigs } from './SlackMock';
import { JustCallMock, createJustCallMockConfigs } from './JustCallMock';
import { SavvyCalMock, createSavvyCalMockConfigs } from './SavvyCalMock';
import { SupabaseMock, createSupabaseMockConfigs } from './SupabaseMock';

// ============================================================================
// Types
// ============================================================================

export type IntegrationMockType =
  | HubSpotMock
  | FathomMock
  | GoogleMock
  | SlackMock
  | JustCallMock
  | SavvyCalMock
  | SupabaseMock;

export interface IntegrationMockInstance {
  integration: string;
  mock: IntegrationMockType;
  configs: ProcessMapMock[];
}

export type SupportedIntegration =
  | 'hubspot'
  | 'fathom'
  | 'google'
  | 'slack'
  | 'justcall'
  | 'savvycal'
  | 'supabase';

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
    const integrationMocks = this.mocks.get(integration.toLowerCase());
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
    return this.mocks.get(integration.toLowerCase()) || [];
  }

  /**
   * Get or create a mock instance for an integration
   */
  getInstance(
    integration: string,
    workflowId: string,
    orgId: string
  ): IntegrationMockInstance | undefined {
    const normalizedIntegration = integration.toLowerCase();
    const key = `${normalizedIntegration}:${workflowId}`;

    if (this.instances.has(key)) {
      return this.instances.get(key);
    }

    // Create new instance based on integration type
    let instance: IntegrationMockInstance | undefined;

    switch (normalizedIntegration) {
      case 'hubspot': {
        const mock = new HubSpotMock({ preloadData: true });
        const configs = createHubSpotMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      case 'fathom': {
        const mock = new FathomMock({ preloadData: true });
        const configs = createFathomMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      case 'google': {
        const mock = new GoogleMock({ preloadData: true });
        const configs = createGoogleMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      case 'slack': {
        const mock = new SlackMock({ preloadData: true });
        const configs = createSlackMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      case 'justcall': {
        const mock = new JustCallMock({ preloadData: true });
        const configs = createJustCallMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      case 'savvycal': {
        const mock = new SavvyCalMock({ preloadData: true });
        const configs = createSavvyCalMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      case 'supabase': {
        const mock = new SupabaseMock({ preloadData: true, orgId });
        const configs = createSupabaseMockConfigs(workflowId, orgId);
        instance = { integration: normalizedIntegration, mock, configs };
        break;
      }

      default:
        return undefined;
    }

    if (instance) {
      // Load configs into registry
      this.loadConfigs(instance.configs);
      this.instances.set(key, instance);
    }

    return instance;
  }

  /**
   * Get all instances for a workflow
   */
  getWorkflowInstances(workflowId: string): IntegrationMockInstance[] {
    const instances: IntegrationMockInstance[] = [];
    for (const [key, instance] of this.instances.entries()) {
      if (key.endsWith(`:${workflowId}`)) {
        instances.push(instance);
      }
    }
    return instances;
  }

  /**
   * Register a custom mock configuration
   */
  registerMock(config: ProcessMapMock): void {
    const existing = this.mocks.get(config.integration.toLowerCase()) || [];
    existing.push(config);
    existing.sort((a, b) => b.priority - a.priority);
    this.mocks.set(config.integration.toLowerCase(), existing);
  }

  /**
   * Remove a mock configuration
   */
  removeMock(mockId: string): void {
    for (const [integration, mocks] of this.mocks.entries()) {
      const filtered = mocks.filter((m) => m.id !== mockId);
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
    const mocks = this.mocks.get(integration.toLowerCase());
    return !!mocks && mocks.length > 0;
  }

  /**
   * Get all registered integrations
   */
  getIntegrations(): string[] {
    return Array.from(this.mocks.keys());
  }

  /**
   * Get all registered mocks
   */
  getAllMocks(): ProcessMapMock[] {
    const allMocks: ProcessMapMock[] = [];
    for (const mocks of this.mocks.values()) {
      allMocks.push(...mocks);
    }
    return allMocks;
  }

  /**
   * Clear all mocks and instances
   */
  reset(): void {
    this.mocks.clear();
    for (const instance of this.instances.values()) {
      if ('reset' in instance.mock && typeof instance.mock.reset === 'function') {
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
export function createTestMockRegistry(
  workflowId: string,
  orgId: string,
  integrations?: SupportedIntegration[]
): MockRegistry {
  const registry = new MockRegistry();

  // If specific integrations provided, only initialize those
  const targetIntegrations: SupportedIntegration[] = integrations || [
    'hubspot',
    'fathom',
    'google',
    'slack',
    'justcall',
    'savvycal',
    'supabase',
  ];

  for (const integration of targetIntegrations) {
    registry.getInstance(integration, workflowId, orgId);
  }

  return registry;
}

/**
 * Create a mock registry with only specific integrations
 */
export function createIntegrationMockRegistry(
  workflowId: string,
  orgId: string,
  integrations: SupportedIntegration[]
): MockRegistry {
  return createTestMockRegistry(workflowId, orgId, integrations);
}

/**
 * Get all mocks from a registry as a flat array (for test engine)
 */
export function getAllMocksFromRegistry(registry: MockRegistry): ProcessMapMock[] {
  return registry.getAllMocks();
}

