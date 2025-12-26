/**
 * ResourceTracker - Tracks resources created during test_data mode
 *
 * Maintains a registry of all resources created during test execution,
 * enabling cleanup and providing links to view resources in 3rd party apps.
 */

import {
  TrackedResource,
  TestableIntegration,
  ResourceType,
  CleanupStatus,
} from '@/lib/types/processMapTesting';

/**
 * Options for adding a new resource
 */
export interface AddResourceOptions {
  integration: TestableIntegration;
  resourceType: ResourceType;
  displayName: string;
  externalId: string | null;
  viewUrl: string | null;
  createdByStepId: string;
  createdByStepName: string;
  rawData?: Record<string, unknown>;
}

/**
 * ResourceTracker class
 *
 * Manages the lifecycle of resources created during test_data mode execution:
 * - Tracks all created resources with metadata
 * - Provides ordered access for cleanup (reverse creation order)
 * - Updates cleanup status and handles errors
 * - Generates manual cleanup instructions for failed operations
 */
export class ResourceTracker {
  private resources: Map<string, TrackedResource> = new Map();
  private creationOrder: string[] = [];

  /**
   * Add a new resource to the tracker
   */
  addResource(options: AddResourceOptions): TrackedResource {
    const id = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const resource: TrackedResource = {
      id,
      integration: options.integration,
      resourceType: options.resourceType,
      displayName: options.displayName,
      externalId: options.externalId,
      viewUrl: options.viewUrl,
      createdByStepId: options.createdByStepId,
      createdByStepName: options.createdByStepName,
      createdAt: new Date().toISOString(),
      cleanupStatus: 'pending',
      cleanupError: null,
      cleanupAttemptedAt: null,
      rawData: options.rawData,
    };

    this.resources.set(id, resource);
    this.creationOrder.push(id);

    return resource;
  }

  /**
   * Get a resource by ID
   */
  getResource(id: string): TrackedResource | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all resources
   */
  getAllResources(): TrackedResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resources in cleanup order (reverse of creation order)
   * This ensures dependent resources are deleted first
   * (e.g., delete deals before contacts in HubSpot)
   */
  getResourcesInCleanupOrder(): TrackedResource[] {
    return [...this.creationOrder]
      .reverse()
      .map(id => this.resources.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get resources by integration
   */
  getResourcesByIntegration(integration: TestableIntegration): TrackedResource[] {
    return this.getAllResources().filter(r => r.integration === integration);
  }

  /**
   * Get resources by step
   */
  getResourcesByStep(stepId: string): TrackedResource[] {
    return this.getAllResources().filter(r => r.createdByStepId === stepId);
  }

  /**
   * Get resources pending cleanup
   */
  getPendingCleanupResources(): TrackedResource[] {
    return this.getAllResources().filter(r => r.cleanupStatus === 'pending');
  }

  /**
   * Get resources that failed cleanup
   */
  getFailedCleanupResources(): TrackedResource[] {
    return this.getAllResources().filter(r => r.cleanupStatus === 'failed');
  }

  /**
   * Update cleanup status for a resource
   */
  updateCleanupStatus(
    id: string,
    status: CleanupStatus,
    error?: string
  ): void {
    const resource = this.resources.get(id);
    if (!resource) {
      console.warn(`[ResourceTracker] Resource not found: ${id}`);
      return;
    }

    resource.cleanupStatus = status;
    resource.cleanupAttemptedAt = new Date().toISOString();

    if (error) {
      resource.cleanupError = error;
    }
  }

  /**
   * Mark all resources for a specific integration as not supported for cleanup
   */
  markIntegrationAsNotSupported(integration: TestableIntegration): void {
    this.getResourcesByIntegration(integration).forEach(resource => {
      this.updateCleanupStatus(resource.id, 'not_supported');
    });
  }

  /**
   * Generate manual cleanup instructions for resources that couldn't be auto-cleaned
   */
  getManualCleanupInstructions(): string[] {
    const instructions: string[] = [];
    const failedResources = this.getFailedCleanupResources();
    const notSupportedResources = this.getAllResources().filter(
      r => r.cleanupStatus === 'not_supported'
    );

    // Group by integration for easier manual cleanup
    const byIntegration = new Map<TestableIntegration, TrackedResource[]>();

    [...failedResources, ...notSupportedResources].forEach(resource => {
      const existing = byIntegration.get(resource.integration) || [];
      existing.push(resource);
      byIntegration.set(resource.integration, existing);
    });

    byIntegration.forEach((resources, integration) => {
      const header = this.getIntegrationCleanupHeader(integration);
      instructions.push(header);

      resources.forEach(resource => {
        if (resource.viewUrl) {
          instructions.push(
            `  - ${resource.displayName} (${resource.resourceType}): ${resource.viewUrl}`
          );
        } else if (resource.externalId) {
          instructions.push(
            `  - ${resource.displayName} (${resource.resourceType}): ID ${resource.externalId}`
          );
        } else {
          instructions.push(
            `  - ${resource.displayName} (${resource.resourceType}): Created by "${resource.createdByStepName}"`
          );
        }

        if (resource.cleanupError) {
          instructions.push(`    Error: ${resource.cleanupError}`);
        }
      });

      instructions.push(''); // Empty line between integrations
    });

    return instructions;
  }

  /**
   * Get cleanup header for an integration
   */
  private getIntegrationCleanupHeader(integration: TestableIntegration): string {
    const headers: Record<TestableIntegration, string> = {
      hubspot: '📊 HubSpot - Delete these records manually:',
      fathom: '🎥 Fathom - These records are read-only:',
      google_calendar: '📅 Google Calendar - Delete these events:',
      google_email: '📧 Google Email - These emails were sent:',
      slack: '💬 Slack - Delete these messages:',
      justcall: '📞 JustCall - These call records are read-only:',
      savvycal: '📆 SavvyCal - Cancel/delete these bookings:',
      supabase: '🗄️ Supabase - Delete these database records:',
    };
    return headers[integration];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    byIntegration: Record<string, number>;
    byStatus: Record<CleanupStatus, number>;
  } {
    const resources = this.getAllResources();

    const byIntegration: Record<string, number> = {};
    const byStatus: Record<CleanupStatus, number> = {
      pending: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      not_supported: 0,
    };

    resources.forEach(resource => {
      byIntegration[resource.integration] = (byIntegration[resource.integration] || 0) + 1;
      byStatus[resource.cleanupStatus]++;
    });

    return {
      total: resources.length,
      byIntegration,
      byStatus,
    };
  }

  /**
   * Clear all tracked resources
   */
  clear(): void {
    this.resources.clear();
    this.creationOrder = [];
  }

  /**
   * Export resources for persistence/debugging
   */
  export(): TrackedResource[] {
    return this.getAllResources();
  }

  /**
   * Import resources (e.g., from a saved test run)
   */
  import(resources: TrackedResource[]): void {
    this.clear();
    resources.forEach(resource => {
      this.resources.set(resource.id, resource);
      this.creationOrder.push(resource.id);
    });
  }
}
