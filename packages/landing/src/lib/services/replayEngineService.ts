/**
 * Replay Engine Service
 * Provides deterministic execution replay using recorded data
 */

import { Node, Edge } from 'reactflow';
import { supabase } from '@/lib/supabase/clientV2';
import { executionSnapshotService, ExecutionSnapshot, HttpRequest } from './executionSnapshotService';
import { fixtureManagementService } from './fixtureManagementService';
import { WorkflowEnvironment } from './workflowEnvironmentService';
import logger from '@/lib/utils/logger';

export interface ReplayOptions {
  executionId?: string;
  scenarioName?: string;
  environment: WorkflowEnvironment;
  speed: 'realtime' | 'fast' | 'step';
  breakpoints?: string[]; // Node IDs to break at
  modifications?: Record<string, any>; // Modifications to apply during replay
  compareWith?: string; // Another execution ID to compare with
  recordNewExecution?: boolean;
}

export interface ReplayState {
  currentNodeId: string;
  currentStep: number;
  totalSteps: number;
  isPaused: boolean;
  isComplete: boolean;
  nodeOutputs: Map<string, any>;
  variables: Record<string, any>;
  errors: Array<{ nodeId: string; error: string; timestamp: string }>;
}

export interface ReplayResult {
  success: boolean;
  executionTime: number;
  replayedNodes: number;
  nodeOutputs: Record<string, any>;
  differences?: Array<{
    nodeId: string;
    field: string;
    original: any;
    replayed: any;
  }>;
  errors?: string[];
}

export type ReplayEventHandler = (event: ReplayEvent) => void;

export interface ReplayEvent {
  type: 'node-start' | 'node-complete' | 'node-error' | 'http-request' | 'breakpoint' | 'complete';
  nodeId?: string;
  data?: any;
  error?: string;
  timestamp: string;
}

class ReplayEngineService {
  private static instance: ReplayEngineService;
  private replayState: ReplayState | null = null;
  private snapshots: ExecutionSnapshot[] = [];
  private httpRequests: Map<string, HttpRequest[]> = new Map();
  private eventHandlers: Set<ReplayEventHandler> = new Set();
  private replaySpeed: number = 1; // 1 = realtime, 0 = fast, -1 = step
  private isPaused: boolean = false;
  private breakpoints: Set<string> = new Set();
  private stepResolver: (() => void) | null = null;

  private constructor() {}

  static getInstance(): ReplayEngineService {
    if (!ReplayEngineService.instance) {
      ReplayEngineService.instance = new ReplayEngineService();
    }
    return ReplayEngineService.instance;
  }

  /**
   * Start replay execution
   */
  async startReplay(
    workflowId: string,
    nodes: Node[],
    edges: Edge[],
    options: ReplayOptions
  ): Promise<ReplayResult> {
    try {
      logger.info(`Starting replay for workflow ${workflowId}`, options);

      // Initialize replay state
      this.replayState = {
        currentNodeId: '',
        currentStep: 0,
        totalSteps: 0,
        isPaused: false,
        isComplete: false,
        nodeOutputs: new Map(),
        variables: {},
        errors: []
      };

      // Set replay options
      this.setReplaySpeed(options.speed);
      this.breakpoints = new Set(options.breakpoints || []);

      // Load replay data
      let replayData: ExecutionSnapshot[] = [];
      let fixtureData: Record<string, any> = {};

      if (options.executionId) {
        // Load from execution snapshots
        replayData = await this.loadExecutionSnapshots(options.executionId);
      } else if (options.scenarioName) {
        // Load from scenario fixtures
        fixtureData = await this.loadScenarioFixtures(workflowId, options.scenarioName);
      } else {
        // Load from pinned inputs
        fixtureData = await this.loadPinnedInputs(workflowId, options.environment);
      }

      if (replayData.length === 0 && Object.keys(fixtureData).length === 0) {
        throw new Error('No replay data available');
      }

      this.snapshots = replayData;
      this.replayState.totalSteps = replayData.length || nodes.length;

      // Load HTTP recordings if available
      if (options.executionId) {
        await this.loadHttpRecordings(options.executionId);
      }

      // Find the trigger node
      const triggerNode = nodes.find(node => 
        !edges.some(edge => edge.target === node.id)
      );

      if (!triggerNode) {
        throw new Error('No trigger node found');
      }

      // Start replay execution
      const startTime = Date.now();
      const result = await this.replayNode(
        triggerNode,
        nodes,
        edges,
        replayData,
        fixtureData,
        options
      );

      const executionTime = Date.now() - startTime;

      // Compare with original if requested
      let differences: ReplayResult['differences'];
      if (options.compareWith) {
        differences = await this.compareExecutions(
          options.executionId || '',
          options.compareWith
        );
      }

      // Convert node outputs map to object
      const nodeOutputs: Record<string, any> = {};
      this.replayState.nodeOutputs.forEach((value, key) => {
        nodeOutputs[key] = value;
      });

      return {
        success: this.replayState.errors.length === 0,
        executionTime,
        replayedNodes: this.replayState.nodeOutputs.size,
        nodeOutputs,
        differences,
        errors: this.replayState.errors.map(e => e.error)
      };
    } catch (error) {
      logger.error('Replay execution failed:', error);
      return {
        success: false,
        executionTime: 0,
        replayedNodes: 0,
        nodeOutputs: {},
        errors: [(error as Error).message]
      };
    } finally {
      this.cleanup();
    }
  }

  /**
   * Replay a single node
   */
  private async replayNode(
    node: Node,
    allNodes: Node[],
    edges: Edge[],
    snapshots: ExecutionSnapshot[],
    fixtures: Record<string, any>,
    options: ReplayOptions
  ): Promise<any> {
    if (!this.replayState) return null;

    this.replayState.currentNodeId = node.id;
    this.replayState.currentStep++;

    // Emit node start event
    this.emitEvent({
      type: 'node-start',
      nodeId: node.id,
      timestamp: new Date().toISOString()
    });

    // Check for breakpoint
    if (this.breakpoints.has(node.id)) {
      await this.handleBreakpoint(node.id);
    }

    // Apply replay speed
    await this.applyReplaySpeed();

    try {
      let nodeOutput: any;

      // Check for recorded snapshot
      const snapshot = snapshots.find(s => 
        s.nodeId === node.id && s.snapshotType === 'after'
      );

      if (snapshot) {
        // Use recorded output
        nodeOutput = snapshot.nodeOutputs[node.id] || snapshot.state;
        
        // Apply modifications if specified
        if (options.modifications?.[node.id]) {
          nodeOutput = this.applyModifications(nodeOutput, options.modifications[node.id]);
        }
      } else if (fixtures[node.id]) {
        // Use fixture data
        nodeOutput = fixtures[node.id];
      } else {
        // Simulate node execution with mock data
        nodeOutput = await this.simulateNodeExecution(node, this.replayState.variables);
      }

      // Store output
      this.replayState.nodeOutputs.set(node.id, nodeOutput);
      this.replayState.variables[node.id] = nodeOutput;

      // Emit node complete event
      this.emitEvent({
        type: 'node-complete',
        nodeId: node.id,
        data: nodeOutput,
        timestamp: new Date().toISOString()
      });

      // Find and replay next nodes
      const nextEdges = edges.filter(edge => edge.source === node.id);
      for (const edge of nextEdges) {
        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode) {
          await this.replayNode(nextNode, allNodes, edges, snapshots, fixtures, options);
        }
      }

      return nodeOutput;
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Record error
      this.replayState.errors.push({
        nodeId: node.id,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });

      // Emit error event
      this.emitEvent({
        type: 'node-error',
        nodeId: node.id,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Simulate node execution with mock data
   */
  private async simulateNodeExecution(
    node: Node,
    variables: Record<string, any>
  ): Promise<any> {
    // Check for HTTP recordings
    const httpRecordings = this.httpRequests.get(node.id);
    
    if (httpRecordings && httpRecordings.length > 0) {
      // Return recorded HTTP response
      const recording = httpRecordings[0];
      
      this.emitEvent({
        type: 'http-request',
        nodeId: node.id,
        data: {
          method: recording.method,
          url: recording.url,
          response: recording.response
        },
        timestamp: new Date().toISOString()
      });

      return recording.response?.body || {};
    }

    // Generate mock data based on node type
    switch (node.type) {
      case 'trigger':
        return {
          triggered: true,
          timestamp: new Date().toISOString(),
          data: variables.triggerData || {}
        };

      case 'condition':
        return {
          result: true,
          evaluated: variables[node.data.config?.field] || true
        };

      case 'action':
        return {
          success: true,
          actionType: node.data.config?.actionType || 'unknown',
          result: { id: `mock-${node.id}`, status: 'completed' }
        };

      case 'delay':
        return {
          delayed: true,
          duration: node.data.config?.duration || 1000
        };

      default:
        return {
          nodeId: node.id,
          type: node.type,
          mockData: true
        };
    }
  }

  /**
   * Load execution snapshots
   */
  private async loadExecutionSnapshots(executionId: string): Promise<ExecutionSnapshot[]> {
    const timeline = await executionSnapshotService.getExecutionTimeline(executionId);
    return timeline?.snapshots || [];
  }

  /**
   * Load scenario fixtures
   */
  private async loadScenarioFixtures(
    workflowId: string,
    scenarioName: string
  ): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('scenario_fixtures')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('scenario_name', scenarioName)
      .single();

    if (error || !data) {
      return {};
    }

    // Load node fixtures
    const fixtures: Record<string, any> = {};
    
    if (data.node_fixtures && data.node_fixtures.length > 0) {
      const { data: nodeFixtures } = await supabase
        .from('node_fixtures')
        .select('*')
        .in('id', data.node_fixtures);

      for (const fixture of nodeFixtures || []) {
        fixtures[fixture.node_id] = fixture.data;
      }
    }

    // Add expected outputs
    Object.assign(fixtures, data.expected_outputs);

    return fixtures;
  }

  /**
   * Load pinned inputs
   */
  private async loadPinnedInputs(
    workflowId: string,
    environment: WorkflowEnvironment
  ): Promise<Record<string, any>> {
    const fixtures = await fixtureManagementService.getWorkflowFixtures(
      workflowId,
      environment
    );

    const inputs: Record<string, any> = {};
    
    for (const fixture of fixtures) {
      if (fixture.fixtureType === 'input') {
        inputs[fixture.nodeId] = fixture.data;
      }
    }

    return inputs;
  }

  /**
   * Load HTTP recordings
   */
  private async loadHttpRecordings(executionId: string): Promise<void> {
    const recordings = await executionSnapshotService.getRecordedHttpRequests(executionId);
    
    // Group by node ID
    for (const recording of recordings) {
      const nodeRecordings = this.httpRequests.get(recording.id) || [];
      nodeRecordings.push(recording);
      this.httpRequests.set(recording.id, nodeRecordings);
    }
  }

  /**
   * Compare two executions
   */
  private async compareExecutions(
    execution1: string,
    execution2: string
  ): Promise<ReplayResult['differences']> {
    const comparison = await executionSnapshotService.compareExecutions(
      execution1,
      execution2
    );

    return comparison.differences.map(diff => ({
      nodeId: diff.nodeId,
      field: diff.field,
      original: diff.value1,
      replayed: diff.value2
    }));
  }

  /**
   * Apply modifications to output
   */
  private applyModifications(output: any, modifications: any): any {
    if (typeof modifications === 'function') {
      return modifications(output);
    }
    
    return { ...output, ...modifications };
  }

  /**
   * Set replay speed
   */
  private setReplaySpeed(speed: ReplayOptions['speed']): void {
    switch (speed) {
      case 'realtime':
        this.replaySpeed = 1;
        break;
      case 'fast':
        this.replaySpeed = 0;
        break;
      case 'step':
        this.replaySpeed = -1;
        break;
    }
  }

  /**
   * Apply replay speed delay
   */
  private async applyReplaySpeed(): Promise<void> {
    if (this.replaySpeed === 0) {
      // Fast mode - no delay
      return;
    }

    if (this.replaySpeed === -1) {
      // Step mode - wait for user to continue
      await this.waitForStep();
      return;
    }

    // Realtime mode - add realistic delay
    const delay = Math.random() * 500 + 100; // 100-600ms
    await new Promise(resolve => setTimeout(resolve, delay * this.replaySpeed));
  }

  /**
   * Wait for step continuation
   */
  private async waitForStep(): Promise<void> {
    if (this.isPaused) {
      return new Promise(resolve => {
        this.stepResolver = resolve;
      });
    }
  }

  /**
   * Handle breakpoint
   */
  private async handleBreakpoint(nodeId: string): Promise<void> {
    this.isPaused = true;
    
    this.emitEvent({
      type: 'breakpoint',
      nodeId,
      timestamp: new Date().toISOString()
    });

    // Wait for resume
    await this.waitForStep();
  }

  /**
   * Pause replay
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume replay
   */
  resume(): void {
    this.isPaused = false;
    if (this.stepResolver) {
      this.stepResolver();
      this.stepResolver = null;
    }
  }

  /**
   * Step to next node
   */
  step(): void {
    if (this.stepResolver) {
      this.stepResolver();
      this.stepResolver = null;
    }
  }

  /**
   * Add breakpoint
   */
  addBreakpoint(nodeId: string): void {
    this.breakpoints.add(nodeId);
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(nodeId: string): void {
    this.breakpoints.delete(nodeId);
  }

  /**
   * Get current replay state
   */
  getReplayState(): ReplayState | null {
    return this.replayState;
  }

  /**
   * Add event handler
   */
  onEvent(handler: ReplayEventHandler): () => void {
    this.eventHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit replay event
   */
  private emitEvent(event: ReplayEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Error in replay event handler:', error);
      }
    }
  }

  /**
   * Clean up replay state
   */
  private cleanup(): void {
    this.replayState = null;
    this.snapshots = [];
    this.httpRequests.clear();
    this.breakpoints.clear();
    this.stepResolver = null;
    this.isPaused = false;
    
    // Emit complete event
    this.emitEvent({
      type: 'complete',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Export replay data
   */
  async exportReplayData(executionId: string): Promise<{
    snapshots: ExecutionSnapshot[];
    httpRequests: HttpRequest[];
    metadata: Record<string, any>;
  }> {
    const snapshots = await this.loadExecutionSnapshots(executionId);
    const httpRequests = await executionSnapshotService.getRecordedHttpRequests(executionId);
    
    return {
      snapshots,
      httpRequests,
      metadata: {
        executionId,
        exportedAt: new Date().toISOString(),
        snapshotCount: snapshots.length,
        httpRequestCount: httpRequests.length
      }
    };
  }

  /**
   * Import replay data
   */
  async importReplayData(
    workflowId: string,
    data: {
      snapshots: ExecutionSnapshot[];
      httpRequests: HttpRequest[];
    }
  ): Promise<boolean> {
    try {
      // Generate new execution ID for imported data
      const importedExecutionId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Import snapshots
      for (const snapshot of data.snapshots) {
        await executionSnapshotService.captureSnapshot(
          importedExecutionId,
          workflowId,
          snapshot.nodeId,
          snapshot.snapshotType,
          snapshot.state,
          snapshot.variables,
          snapshot.nodeOutputs,
          snapshot.errorDetails
        );
      }
      
      // Import HTTP requests
      for (const request of data.httpRequests) {
        await executionSnapshotService.recordHttpRequest(
          importedExecutionId,
          workflowId,
          '', // Node ID not available in import
          request
        );
      }
      
      logger.info(`Imported replay data as execution ${importedExecutionId}`);
      return true;
    } catch (error) {
      logger.error('Failed to import replay data:', error);
      return false;
    }
  }
}

export const replayEngineService = ReplayEngineService.getInstance();