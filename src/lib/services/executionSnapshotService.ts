/**
 * Execution Snapshot Service
 * Provides time-travel debugging and state management for workflow executions
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export interface ExecutionSnapshot {
  id?: string;
  executionId: string;
  workflowId: string;
  nodeId: string;
  sequenceNumber: number;
  snapshotType: 'before' | 'after' | 'error';
  state: Record<string, any>;
  variables: Record<string, any>;
  nodeOutputs: Record<string, any>;
  httpRequests: Array<HttpRequest>;
  errorDetails?: {
    message: string;
    stack?: string;
    code?: string;
  };
  memoryUsage?: number;
  cpuTime?: number;
  timestamp: string;
}

export interface HttpRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  response?: {
    status: number;
    headers: Record<string, string>;
    body: any;
    timeMs: number;
  };
  error?: string;
}

export interface ExecutionCheckpoint {
  id?: string;
  executionId: string;
  workflowId: string;
  checkpointName: string;
  nodeId: string;
  state: Record<string, any>;
  variables: Record<string, any>;
  nodeOutputs: Record<string, any>;
  canResume: boolean;
  createdAt: string;
}

export interface ExecutionTimeline {
  executionId: string;
  workflowId: string;
  startTime: string;
  endTime?: string;
  snapshots: ExecutionSnapshot[];
  checkpoints: ExecutionCheckpoint[];
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
}

export interface ForkOptions {
  fromSnapshot?: string;
  fromCheckpoint?: string;
  modifyState?: (state: Record<string, any>) => Record<string, any>;
  modifyVariables?: (variables: Record<string, any>) => Record<string, any>;
}

class ExecutionSnapshotService {
  private static instance: ExecutionSnapshotService;
  private snapshotCache: Map<string, ExecutionSnapshot[]> = new Map();
  private httpRecordingEnabled: boolean = true;
  private maxSnapshotsPerExecution: number = 1000;
  private sequenceCounters: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): ExecutionSnapshotService {
    if (!ExecutionSnapshotService.instance) {
      ExecutionSnapshotService.instance = new ExecutionSnapshotService();
    }
    return ExecutionSnapshotService.instance;
  }

  /**
   * Capture execution snapshot
   */
  async captureSnapshot(
    executionId: string,
    workflowId: string,
    nodeId: string,
    snapshotType: ExecutionSnapshot['snapshotType'],
    state: Record<string, any>,
    variables: Record<string, any> = {},
    nodeOutputs: Record<string, any> = {},
    errorDetails?: ExecutionSnapshot['errorDetails']
  ): Promise<ExecutionSnapshot | null> {
    try {
      // Get or initialize sequence counter
      const sequenceKey = `${executionId}-${nodeId}`;
      let sequenceNumber = this.sequenceCounters.get(sequenceKey) || 0;
      sequenceNumber++;
      this.sequenceCounters.set(sequenceKey, sequenceNumber);

      // Calculate memory usage if possible
      const memoryUsage = this.calculateMemoryUsage(state, variables, nodeOutputs);

      const snapshot: ExecutionSnapshot = {
        executionId,
        workflowId,
        nodeId,
        sequenceNumber,
        snapshotType,
        state: this.sanitizeState(state),
        variables: this.sanitizeState(variables),
        nodeOutputs: this.sanitizeState(nodeOutputs),
        httpRequests: [],
        errorDetails,
        memoryUsage,
        timestamp: new Date().toISOString()
      };

      // Save to database
      const { data, error } = await supabase
        .from('execution_snapshots')
        .insert({
          execution_id: snapshot.executionId,
          workflow_id: snapshot.workflowId,
          node_id: snapshot.nodeId,
          sequence_number: snapshot.sequenceNumber,
          snapshot_type: snapshot.snapshotType,
          state: snapshot.state,
          variables: snapshot.variables,
          node_outputs: snapshot.nodeOutputs,
          http_requests: snapshot.httpRequests,
          error_details: snapshot.errorDetails,
          memory_usage: snapshot.memoryUsage,
          cpu_time: snapshot.cpuTime
        })
        .select()
        .single();

      if (error) throw error;

      snapshot.id = data.id;

      // Update cache
      const cacheKey = executionId;
      const cached = this.snapshotCache.get(cacheKey) || [];
      cached.push(snapshot);
      
      // Limit cache size
      if (cached.length > this.maxSnapshotsPerExecution) {
        cached.shift();
      }
      
      this.snapshotCache.set(cacheKey, cached);

      logger.debug(`Captured ${snapshotType} snapshot for node ${nodeId} in execution ${executionId}`);
      return snapshot;
    } catch (error) {
      logger.error('Failed to capture snapshot:', error);
      return null;
    }
  }

  /**
   * Record HTTP request for replay
   */
  async recordHttpRequest(
    executionId: string,
    workflowId: string,
    nodeId: string,
    request: Omit<HttpRequest, 'id'>
  ): Promise<boolean> {
    if (!this.httpRecordingEnabled) {
      return true;
    }

    try {
      const sequenceKey = `${executionId}-http`;
      let requestSequence = this.sequenceCounters.get(sequenceKey) || 0;
      requestSequence++;
      this.sequenceCounters.set(sequenceKey, requestSequence);

      const { error } = await supabase
        .from('http_request_recordings')
        .insert({
          execution_id: executionId,
          workflow_id: workflowId,
          node_id: nodeId,
          request_sequence: requestSequence,
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
          response_status: request.response?.status,
          response_headers: request.response?.headers,
          response_body: request.response?.body,
          response_time_ms: request.response?.timeMs,
          error: request.error
        });

      if (error) throw error;

      logger.debug(`Recorded HTTP ${request.method} request to ${request.url}`);
      return true;
    } catch (error) {
      logger.error('Failed to record HTTP request:', error);
      return false;
    }
  }

  /**
   * Create execution checkpoint
   */
  async createCheckpoint(
    executionId: string,
    workflowId: string,
    checkpointName: string,
    nodeId: string,
    state: Record<string, any>,
    variables: Record<string, any> = {},
    nodeOutputs: Record<string, any> = {}
  ): Promise<ExecutionCheckpoint | null> {
    try {
      const checkpoint: ExecutionCheckpoint = {
        executionId,
        workflowId,
        checkpointName,
        nodeId,
        state: this.sanitizeState(state),
        variables: this.sanitizeState(variables),
        nodeOutputs: this.sanitizeState(nodeOutputs),
        canResume: true,
        createdAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('execution_checkpoints')
        .insert({
          execution_id: checkpoint.executionId,
          workflow_id: checkpoint.workflowId,
          checkpoint_name: checkpoint.checkpointName,
          node_id: checkpoint.nodeId,
          state: checkpoint.state,
          variables: checkpoint.variables,
          node_outputs: checkpoint.nodeOutputs,
          can_resume: checkpoint.canResume
        })
        .select()
        .single();

      if (error) throw error;

      checkpoint.id = data.id;

      logger.info(`Created checkpoint '${checkpointName}' for execution ${executionId}`);
      return checkpoint;
    } catch (error) {
      logger.error('Failed to create checkpoint:', error);
      return null;
    }
  }

  /**
   * Get execution timeline
   */
  async getExecutionTimeline(executionId: string): Promise<ExecutionTimeline | null> {
    try {
      // Fetch snapshots
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('execution_snapshots')
        .select('*')
        .eq('execution_id', executionId)
        .order('sequence_number', { ascending: true });

      if (snapshotsError) throw snapshotsError;

      // Fetch checkpoints
      const { data: checkpoints, error: checkpointsError } = await supabase
        .from('execution_checkpoints')
        .select('*')
        .eq('execution_id', executionId)
        .order('created_at', { ascending: true });

      if (checkpointsError) throw checkpointsError;

      if (!snapshots || snapshots.length === 0) {
        return null;
      }

      // Map database records to types
      const mappedSnapshots: ExecutionSnapshot[] = snapshots.map(s => ({
        id: s.id,
        executionId: s.execution_id,
        workflowId: s.workflow_id,
        nodeId: s.node_id,
        sequenceNumber: s.sequence_number,
        snapshotType: s.snapshot_type,
        state: s.state,
        variables: s.variables,
        nodeOutputs: s.node_outputs,
        httpRequests: s.http_requests || [],
        errorDetails: s.error_details,
        memoryUsage: s.memory_usage,
        cpuTime: s.cpu_time,
        timestamp: s.timestamp
      }));

      const mappedCheckpoints: ExecutionCheckpoint[] = (checkpoints || []).map(c => ({
        id: c.id,
        executionId: c.execution_id,
        workflowId: c.workflow_id,
        checkpointName: c.checkpoint_name,
        nodeId: c.node_id,
        state: c.state,
        variables: c.variables,
        nodeOutputs: c.node_outputs,
        canResume: c.can_resume,
        createdAt: c.created_at
      }));

      // Calculate statistics
      const nodeStats = new Map<string, { completed: boolean; failed: boolean }>();
      
      for (const snapshot of mappedSnapshots) {
        const stats = nodeStats.get(snapshot.nodeId) || { completed: false, failed: false };
        
        if (snapshot.snapshotType === 'after') {
          stats.completed = true;
        }
        if (snapshot.snapshotType === 'error') {
          stats.failed = true;
        }
        
        nodeStats.set(snapshot.nodeId, stats);
      }

      const timeline: ExecutionTimeline = {
        executionId,
        workflowId: mappedSnapshots[0].workflowId,
        startTime: mappedSnapshots[0].timestamp,
        endTime: mappedSnapshots[mappedSnapshots.length - 1].timestamp,
        snapshots: mappedSnapshots,
        checkpoints: mappedCheckpoints,
        totalNodes: nodeStats.size,
        completedNodes: Array.from(nodeStats.values()).filter(s => s.completed).length,
        failedNodes: Array.from(nodeStats.values()).filter(s => s.failed).length
      };

      return timeline;
    } catch (error) {
      logger.error('Failed to get execution timeline:', error);
      return null;
    }
  }

  /**
   * Get snapshot at specific point
   */
  async getSnapshotAt(
    executionId: string,
    nodeId: string,
    sequenceNumber: number
  ): Promise<ExecutionSnapshot | null> {
    try {
      const { data, error } = await supabase
        .from('execution_snapshots')
        .select('*')
        .eq('execution_id', executionId)
        .eq('node_id', nodeId)
        .eq('sequence_number', sequenceNumber)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        executionId: data.execution_id,
        workflowId: data.workflow_id,
        nodeId: data.node_id,
        sequenceNumber: data.sequence_number,
        snapshotType: data.snapshot_type,
        state: data.state,
        variables: data.variables,
        nodeOutputs: data.node_outputs,
        httpRequests: data.http_requests || [],
        errorDetails: data.error_details,
        memoryUsage: data.memory_usage,
        cpuTime: data.cpu_time,
        timestamp: data.timestamp
      };
    } catch (error) {
      logger.error('Failed to get snapshot:', error);
      return null;
    }
  }

  /**
   * Fork execution from a specific point
   */
  async forkExecution(
    originalExecutionId: string,
    options: ForkOptions = {}
  ): Promise<string | null> {
    try {
      let snapshot: ExecutionSnapshot | null = null;
      let checkpoint: ExecutionCheckpoint | null = null;

      // Get the fork point
      if (options.fromSnapshot) {
        const { data } = await supabase
          .from('execution_snapshots')
          .select('*')
          .eq('id', options.fromSnapshot)
          .single();
        
        if (data) {
          snapshot = {
            id: data.id,
            executionId: data.execution_id,
            workflowId: data.workflow_id,
            nodeId: data.node_id,
            sequenceNumber: data.sequence_number,
            snapshotType: data.snapshot_type,
            state: data.state,
            variables: data.variables,
            nodeOutputs: data.node_outputs,
            httpRequests: data.http_requests || [],
            errorDetails: data.error_details,
            memoryUsage: data.memory_usage,
            cpuTime: data.cpu_time,
            timestamp: data.timestamp
          };
        }
      } else if (options.fromCheckpoint) {
        const { data } = await supabase
          .from('execution_checkpoints')
          .select('*')
          .eq('id', options.fromCheckpoint)
          .single();
        
        if (data) {
          checkpoint = {
            id: data.id,
            executionId: data.execution_id,
            workflowId: data.workflow_id,
            checkpointName: data.checkpoint_name,
            nodeId: data.node_id,
            state: data.state,
            variables: data.variables,
            nodeOutputs: data.node_outputs,
            canResume: data.can_resume,
            createdAt: data.created_at
          };
        }
      }

      if (!snapshot && !checkpoint) {
        throw new Error('No valid fork point found');
      }

      // Create new execution ID
      const forkedExecutionId = `fork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Get the state to fork from
      let state = snapshot?.state || checkpoint?.state || {};
      let variables = snapshot?.variables || checkpoint?.variables || {};
      const nodeOutputs = snapshot?.nodeOutputs || checkpoint?.nodeOutputs || {};

      // Apply modifications if provided
      if (options.modifyState) {
        state = options.modifyState(state);
      }
      if (options.modifyVariables) {
        variables = options.modifyVariables(variables);
      }

      // Create initial snapshot for forked execution
      await this.captureSnapshot(
        forkedExecutionId,
        snapshot?.workflowId || checkpoint?.workflowId || '',
        'fork',
        'before',
        state,
        variables,
        nodeOutputs
      );

      logger.info(`Forked execution ${originalExecutionId} to ${forkedExecutionId}`);
      return forkedExecutionId;
    } catch (error) {
      logger.error('Failed to fork execution:', error);
      return null;
    }
  }

  /**
   * Resume execution from checkpoint
   */
  async resumeFromCheckpoint(
    checkpointId: string
  ): Promise<{ executionId: string; state: Record<string, any> } | null> {
    try {
      const { data, error } = await supabase
        .from('execution_checkpoints')
        .select('*')
        .eq('id', checkpointId)
        .single();

      if (error || !data || !data.can_resume) {
        return null;
      }

      // Create new execution ID for resumed execution
      const resumedExecutionId = `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create initial snapshot for resumed execution
      await this.captureSnapshot(
        resumedExecutionId,
        data.workflow_id,
        data.node_id,
        'before',
        data.state,
        data.variables,
        data.node_outputs
      );

      logger.info(`Resumed execution from checkpoint ${checkpointId}`);

      return {
        executionId: resumedExecutionId,
        state: {
          ...data.state,
          variables: data.variables,
          nodeOutputs: data.node_outputs,
          resumedFrom: checkpointId,
          resumedAt: data.node_id
        }
      };
    } catch (error) {
      logger.error('Failed to resume from checkpoint:', error);
      return null;
    }
  }

  /**
   * Get recorded HTTP requests for replay
   */
  async getRecordedHttpRequests(
    executionId: string,
    nodeId?: string
  ): Promise<HttpRequest[]> {
    try {
      let query = supabase
        .from('http_request_recordings')
        .select('*')
        .eq('execution_id', executionId)
        .order('request_sequence', { ascending: true });

      if (nodeId) {
        query = query.eq('node_id', nodeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(r => ({
        id: r.id,
        method: r.method,
        url: r.url,
        headers: r.headers,
        body: r.body,
        response: r.response_status ? {
          status: r.response_status,
          headers: r.response_headers,
          body: r.response_body,
          timeMs: r.response_time_ms
        } : undefined,
        error: r.error
      }));
    } catch (error) {
      logger.error('Failed to get recorded HTTP requests:', error);
      return [];
    }
  }

  /**
   * Compare two executions
   */
  async compareExecutions(
    executionId1: string,
    executionId2: string
  ): Promise<{
    differences: Array<{
      nodeId: string;
      type: 'added' | 'removed' | 'modified';
      field: string;
      value1?: any;
      value2?: any;
    }>;
    similarity: number;
  }> {
    try {
      const timeline1 = await this.getExecutionTimeline(executionId1);
      const timeline2 = await this.getExecutionTimeline(executionId2);

      if (!timeline1 || !timeline2) {
        return { differences: [], similarity: 0 };
      }

      const differences: Array<{
        nodeId: string;
        type: 'added' | 'removed' | 'modified';
        field: string;
        value1?: any;
        value2?: any;
      }> = [];

      // Create maps for easy comparison
      const snapshots1Map = new Map(
        timeline1.snapshots.map(s => [`${s.nodeId}-${s.snapshotType}`, s])
      );
      const snapshots2Map = new Map(
        timeline2.snapshots.map(s => [`${s.nodeId}-${s.snapshotType}`, s])
      );

      // Find differences
      const allKeys = new Set([...snapshots1Map.keys(), ...snapshots2Map.keys()]);
      
      for (const key of allKeys) {
        const [nodeId] = key.split('-');
        const snap1 = snapshots1Map.get(key);
        const snap2 = snapshots2Map.get(key);

        if (!snap1 && snap2) {
          differences.push({
            nodeId,
            type: 'added',
            field: 'node',
            value2: snap2.nodeId
          });
        } else if (snap1 && !snap2) {
          differences.push({
            nodeId,
            type: 'removed',
            field: 'node',
            value1: snap1.nodeId
          });
        } else if (snap1 && snap2) {
          // Compare outputs
          if (JSON.stringify(snap1.nodeOutputs) !== JSON.stringify(snap2.nodeOutputs)) {
            differences.push({
              nodeId,
              type: 'modified',
              field: 'output',
              value1: snap1.nodeOutputs,
              value2: snap2.nodeOutputs
            });
          }

          // Compare error states
          if ((snap1.errorDetails ? 1 : 0) !== (snap2.errorDetails ? 1 : 0)) {
            differences.push({
              nodeId,
              type: 'modified',
              field: 'error',
              value1: snap1.errorDetails,
              value2: snap2.errorDetails
            });
          }
        }
      }

      // Calculate similarity score
      const totalNodes = allKeys.size;
      const differentNodes = differences.length;
      const similarity = totalNodes > 0 
        ? ((totalNodes - differentNodes) / totalNodes) * 100 
        : 100;

      return { differences, similarity };
    } catch (error) {
      logger.error('Failed to compare executions:', error);
      return { differences: [], similarity: 0 };
    }
  }

  /**
   * Calculate memory usage of state objects
   */
  private calculateMemoryUsage(...objects: any[]): number {
    let size = 0;
    
    for (const obj of objects) {
      try {
        const str = JSON.stringify(obj);
        size += str.length * 2; // Rough estimate: 2 bytes per character
      } catch {
        // Ignore circular reference errors
      }
    }
    
    return size;
  }

  /**
   * Sanitize state to prevent sensitive data leakage
   */
  private sanitizeState(state: any): any {
    if (!state) return state;

    const sanitized = JSON.parse(JSON.stringify(state));
    
    const sensitiveKeys = [
      'password', 'secret', 'token', 'key', 'apiKey', 
      'privateKey', 'credential', 'auth'
    ];

    const sanitizeObject = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Clear snapshot cache
   */
  clearCache(): void {
    this.snapshotCache.clear();
    this.sequenceCounters.clear();
  }

  /**
   * Enable/disable HTTP recording
   */
  setHttpRecording(enabled: boolean): void {
    this.httpRecordingEnabled = enabled;
  }
}

export const executionSnapshotService = ExecutionSnapshotService.getInstance();