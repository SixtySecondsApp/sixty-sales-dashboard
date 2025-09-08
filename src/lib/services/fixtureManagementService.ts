/**
 * Fixture Management Service
 * Manages test fixtures, pinned inputs, and golden outputs for workflow testing
 */

import { supabase } from '@/lib/supabase/clientV2';
import { WorkflowEnvironment } from './workflowEnvironmentService';
import logger from '@/lib/utils/logger';

export interface NodeFixture {
  id?: string;
  workflowId: string;
  nodeId: string;
  fixtureName: string;
  fixtureType: 'input' | 'output' | 'golden';
  environment: WorkflowEnvironment;
  data: any;
  metadata: {
    description?: string;
    createdBy?: string;
    tags?: string[];
    version?: number;
    recordedFrom?: string; // execution ID it was recorded from
  };
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScenarioFixture {
  id?: string;
  workflowId: string;
  scenarioName: string;
  description?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  triggerData: any;
  expectedOutputs: Record<string, any>;
  nodeFixtures: string[]; // Array of fixture IDs
  validationRules: Array<{
    nodeId: string;
    field: string;
    operator: 'equals' | 'contains' | 'regex' | 'gt' | 'lt' | 'between';
    value: any;
    value2?: any; // for 'between' operator
  }>;
  isBaseline: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FixtureComparison {
  nodeId: string;
  fixtureName: string;
  matches: boolean;
  differences?: Array<{
    path: string;
    expected: any;
    actual: any;
  }>;
  similarity: number; // 0-100
}

export interface ScenarioExecutionResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  executionTime: number;
  nodeResults: Array<{
    nodeId: string;
    passed: boolean;
    output: any;
    error?: string;
  }>;
  validationResults: Array<{
    rule: ScenarioFixture['validationRules'][0];
    passed: boolean;
    actualValue: any;
  }>;
}

class FixtureManagementService {
  private static instance: FixtureManagementService;
  private fixtureCache: Map<string, NodeFixture> = new Map();
  private scenarioCache: Map<string, ScenarioFixture> = new Map();
  private pinnedInputs: Map<string, any> = new Map();
  private recordingMode: boolean = false;

  private constructor() {}

  static getInstance(): FixtureManagementService {
    if (!FixtureManagementService.instance) {
      FixtureManagementService.instance = new FixtureManagementService();
    }
    return FixtureManagementService.instance;
  }

  /**
   * Pin input for a node
   */
  async pinNodeInput(
    workflowId: string,
    nodeId: string,
    fixtureName: string,
    data: any,
    environment: WorkflowEnvironment,
    metadata: NodeFixture['metadata'] = {}
  ): Promise<NodeFixture | null> {
    try {
      const fixture: NodeFixture = {
        workflowId,
        nodeId,
        fixtureName,
        fixtureType: 'input',
        environment,
        data,
        metadata,
        isActive: true
      };

      const { data: saved, error } = await supabase
        .from('node_fixtures')
        .upsert({
          workflow_id: fixture.workflowId,
          node_id: fixture.nodeId,
          fixture_name: fixture.fixtureName,
          fixture_type: fixture.fixtureType,
          environment: fixture.environment,
          data: fixture.data,
          metadata: fixture.metadata,
          is_active: fixture.isActive
        })
        .select()
        .single();

      if (error) throw error;

      fixture.id = saved.id;
      fixture.createdAt = saved.created_at;
      fixture.updatedAt = saved.updated_at;

      // Update cache
      const cacheKey = `${workflowId}-${nodeId}-${fixtureName}-${environment}`;
      this.fixtureCache.set(cacheKey, fixture);
      
      // Update pinned inputs map for quick access during execution
      const pinnedKey = `${workflowId}-${nodeId}-${environment}`;
      this.pinnedInputs.set(pinnedKey, data);

      logger.info(`Pinned input '${fixtureName}' for node ${nodeId} in ${environment}`);
      return fixture;
    } catch (error) {
      logger.error('Failed to pin node input:', error);
      return null;
    }
  }

  /**
   * Record node output as fixture
   */
  async recordNodeOutput(
    workflowId: string,
    nodeId: string,
    fixtureName: string,
    data: any,
    environment: WorkflowEnvironment,
    executionId?: string,
    asGolden: boolean = false
  ): Promise<NodeFixture | null> {
    try {
      const fixture: NodeFixture = {
        workflowId,
        nodeId,
        fixtureName,
        fixtureType: asGolden ? 'golden' : 'output',
        environment,
        data,
        metadata: {
          recordedFrom: executionId,
          version: 1
        },
        isActive: true
      };

      // Check for existing fixture to increment version
      const { data: existing } = await supabase
        .from('node_fixtures')
        .select('metadata')
        .eq('workflow_id', workflowId)
        .eq('node_id', nodeId)
        .eq('fixture_name', fixtureName)
        .eq('environment', environment)
        .single();

      if (existing?.metadata?.version) {
        fixture.metadata.version = existing.metadata.version + 1;
      }

      const { data: saved, error } = await supabase
        .from('node_fixtures')
        .upsert({
          workflow_id: fixture.workflowId,
          node_id: fixture.nodeId,
          fixture_name: fixture.fixtureName,
          fixture_type: fixture.fixtureType,
          environment: fixture.environment,
          data: fixture.data,
          metadata: fixture.metadata,
          is_active: fixture.isActive
        })
        .select()
        .single();

      if (error) throw error;

      fixture.id = saved.id;
      fixture.createdAt = saved.created_at;
      fixture.updatedAt = saved.updated_at;

      // Update cache
      const cacheKey = `${workflowId}-${nodeId}-${fixtureName}-${environment}`;
      this.fixtureCache.set(cacheKey, fixture);

      logger.info(
        `Recorded ${asGolden ? 'golden' : 'output'} fixture '${fixtureName}' for node ${nodeId}`
      );
      return fixture;
    } catch (error) {
      logger.error('Failed to record node output:', error);
      return null;
    }
  }

  /**
   * Get pinned input for a node
   */
  async getPinnedInput(
    workflowId: string,
    nodeId: string,
    environment: WorkflowEnvironment
  ): Promise<any | null> {
    // Check cache first
    const pinnedKey = `${workflowId}-${nodeId}-${environment}`;
    if (this.pinnedInputs.has(pinnedKey)) {
      return this.pinnedInputs.get(pinnedKey);
    }

    try {
      const { data, error } = await supabase
        .from('node_fixtures')
        .select('data')
        .eq('workflow_id', workflowId)
        .eq('node_id', nodeId)
        .eq('fixture_type', 'input')
        .eq('environment', environment)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      // Cache for future use
      this.pinnedInputs.set(pinnedKey, data.data);
      return data.data;
    } catch (error) {
      logger.error('Failed to get pinned input:', error);
      return null;
    }
  }

  /**
   * Get golden output for comparison
   */
  async getGoldenOutput(
    workflowId: string,
    nodeId: string,
    environment: WorkflowEnvironment
  ): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('node_fixtures')
        .select('data')
        .eq('workflow_id', workflowId)
        .eq('node_id', nodeId)
        .eq('fixture_type', 'golden')
        .eq('environment', environment)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to get golden output:', error);
      return null;
    }
  }

  /**
   * Compare output with golden fixture
   */
  async compareWithGolden(
    workflowId: string,
    nodeId: string,
    actualOutput: any,
    environment: WorkflowEnvironment
  ): Promise<FixtureComparison> {
    const golden = await this.getGoldenOutput(workflowId, nodeId, environment);
    
    if (!golden) {
      return {
        nodeId,
        fixtureName: 'golden',
        matches: false,
        differences: [{
          path: '',
          expected: 'golden fixture',
          actual: 'not found'
        }],
        similarity: 0
      };
    }

    const differences = this.deepCompare(golden, actualOutput);
    const similarity = this.calculateSimilarity(golden, actualOutput);

    return {
      nodeId,
      fixtureName: 'golden',
      matches: differences.length === 0,
      differences,
      similarity
    };
  }

  /**
   * Create scenario fixture
   */
  async createScenarioFixture(
    scenario: Omit<ScenarioFixture, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScenarioFixture | null> {
    try {
      const { data, error } = await supabase
        .from('scenario_fixtures')
        .insert({
          workflow_id: scenario.workflowId,
          scenario_name: scenario.scenarioName,
          description: scenario.description,
          difficulty: scenario.difficulty,
          tags: scenario.tags,
          trigger_data: scenario.triggerData,
          expected_outputs: scenario.expectedOutputs,
          node_fixtures: scenario.nodeFixtures,
          validation_rules: scenario.validationRules,
          is_baseline: scenario.isBaseline
        })
        .select()
        .single();

      if (error) throw error;

      const created: ScenarioFixture = {
        ...scenario,
        id: data.id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      // Update cache
      this.scenarioCache.set(`${scenario.workflowId}-${scenario.scenarioName}`, created);

      logger.info(`Created scenario fixture '${scenario.scenarioName}'`);
      return created;
    } catch (error) {
      logger.error('Failed to create scenario fixture:', error);
      return null;
    }
  }

  /**
   * Execute scenario and validate results
   */
  async executeScenario(
    workflowId: string,
    scenarioName: string,
    actualOutputs: Record<string, any>,
    executionTime: number
  ): Promise<ScenarioExecutionResult> {
    try {
      // Get scenario fixture
      const { data: scenario, error } = await supabase
        .from('scenario_fixtures')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('scenario_name', scenarioName)
        .single();

      if (error || !scenario) {
        throw new Error(`Scenario '${scenarioName}' not found`);
      }

      const nodeResults: ScenarioExecutionResult['nodeResults'] = [];
      const validationResults: ScenarioExecutionResult['validationResults'] = [];

      // Compare outputs for each node
      for (const [nodeId, expectedOutput] of Object.entries(scenario.expected_outputs)) {
        const actualOutput = actualOutputs[nodeId];
        const differences = this.deepCompare(expectedOutput, actualOutput);
        
        nodeResults.push({
          nodeId,
          passed: differences.length === 0,
          output: actualOutput,
          error: differences.length > 0 
            ? `${differences.length} differences found` 
            : undefined
        });
      }

      // Validate using rules
      for (const rule of scenario.validation_rules || []) {
        const actualValue = this.getValueByPath(actualOutputs, `${rule.nodeId}.${rule.field}`);
        const passed = this.validateRule(rule, actualValue);
        
        validationResults.push({
          rule,
          passed,
          actualValue
        });
      }

      const allNodesPassed = nodeResults.every(r => r.passed);
      const allRulesPassed = validationResults.every(r => r.passed);

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.scenario_name,
        passed: allNodesPassed && allRulesPassed,
        executionTime,
        nodeResults,
        validationResults
      };
    } catch (error) {
      logger.error('Failed to execute scenario:', error);
      return {
        scenarioId: '',
        scenarioName,
        passed: false,
        executionTime,
        nodeResults: [],
        validationResults: []
      };
    }
  }

  /**
   * Get all fixtures for a workflow
   */
  async getWorkflowFixtures(
    workflowId: string,
    environment?: WorkflowEnvironment
  ): Promise<NodeFixture[]> {
    try {
      let query = supabase
        .from('node_fixtures')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('is_active', true);

      if (environment) {
        query = query.eq('environment', environment);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(f => ({
        id: f.id,
        workflowId: f.workflow_id,
        nodeId: f.node_id,
        fixtureName: f.fixture_name,
        fixtureType: f.fixture_type,
        environment: f.environment,
        data: f.data,
        metadata: f.metadata,
        isActive: f.is_active,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }));
    } catch (error) {
      logger.error('Failed to get workflow fixtures:', error);
      return [];
    }
  }

  /**
   * Get all scenarios for a workflow
   */
  async getWorkflowScenarios(workflowId: string): Promise<ScenarioFixture[]> {
    try {
      const { data, error } = await supabase
        .from('scenario_fixtures')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('difficulty', { ascending: true });

      if (error) throw error;

      return (data || []).map(s => ({
        id: s.id,
        workflowId: s.workflow_id,
        scenarioName: s.scenario_name,
        description: s.description,
        difficulty: s.difficulty,
        tags: s.tags,
        triggerData: s.trigger_data,
        expectedOutputs: s.expected_outputs,
        nodeFixtures: s.node_fixtures,
        validationRules: s.validation_rules,
        isBaseline: s.is_baseline,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
    } catch (error) {
      logger.error('Failed to get workflow scenarios:', error);
      return [];
    }
  }

  /**
   * Import fixtures from execution
   */
  async importFromExecution(
    executionId: string,
    workflowId: string,
    environment: WorkflowEnvironment,
    asGolden: boolean = false
  ): Promise<number> {
    try {
      // Get execution snapshots
      const { data: snapshots, error } = await supabase
        .from('execution_snapshots')
        .select('*')
        .eq('execution_id', executionId)
        .eq('snapshot_type', 'after')
        .order('sequence_number', { ascending: true });

      if (error) throw error;

      let imported = 0;

      for (const snapshot of snapshots || []) {
        // Import input from 'before' snapshot
        const { data: beforeSnapshot } = await supabase
          .from('execution_snapshots')
          .select('*')
          .eq('execution_id', executionId)
          .eq('node_id', snapshot.node_id)
          .eq('snapshot_type', 'before')
          .single();

        if (beforeSnapshot) {
          await this.pinNodeInput(
            workflowId,
            snapshot.node_id,
            `imported-${executionId}`,
            beforeSnapshot.state,
            environment,
            { recordedFrom: executionId }
          );
          imported++;
        }

        // Import output
        await this.recordNodeOutput(
          workflowId,
          snapshot.node_id,
          `imported-${executionId}`,
          snapshot.node_outputs,
          environment,
          executionId,
          asGolden
        );
        imported++;
      }

      logger.info(`Imported ${imported} fixtures from execution ${executionId}`);
      return imported;
    } catch (error) {
      logger.error('Failed to import fixtures from execution:', error);
      return 0;
    }
  }

  /**
   * Deep compare two objects
   */
  private deepCompare(expected: any, actual: any, path: string = ''): FixtureComparison['differences'] {
    const differences: NonNullable<FixtureComparison['differences']> = [];

    if (expected === actual) {
      return differences;
    }

    if (expected === null || actual === null || expected === undefined || actual === undefined) {
      differences.push({ path, expected, actual });
      return differences;
    }

    if (typeof expected !== typeof actual) {
      differences.push({ path, expected, actual });
      return differences;
    }

    if (typeof expected === 'object') {
      if (Array.isArray(expected)) {
        if (!Array.isArray(actual)) {
          differences.push({ path, expected, actual });
        } else {
          const maxLength = Math.max(expected.length, actual.length);
          for (let i = 0; i < maxLength; i++) {
            const itemPath = `${path}[${i}]`;
            if (i >= expected.length) {
              differences.push({ path: itemPath, expected: undefined, actual: actual[i] });
            } else if (i >= actual.length) {
              differences.push({ path: itemPath, expected: expected[i], actual: undefined });
            } else {
              differences.push(...this.deepCompare(expected[i], actual[i], itemPath));
            }
          }
        }
      } else {
        const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
        for (const key of allKeys) {
          const keyPath = path ? `${path}.${key}` : key;
          if (!(key in expected)) {
            differences.push({ path: keyPath, expected: undefined, actual: actual[key] });
          } else if (!(key in actual)) {
            differences.push({ path: keyPath, expected: expected[key], actual: undefined });
          } else {
            differences.push(...this.deepCompare(expected[key], actual[key], keyPath));
          }
        }
      }
    } else if (expected !== actual) {
      differences.push({ path, expected, actual });
    }

    return differences;
  }

  /**
   * Calculate similarity between two objects
   */
  private calculateSimilarity(obj1: any, obj2: any): number {
    const str1 = JSON.stringify(obj1);
    const str2 = JSON.stringify(obj2);
    
    if (str1 === str2) return 100;
    
    // Simple Levenshtein distance-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100;
    
    const distance = this.levenshteinDistance(str1, str2);
    return Math.max(0, (1 - distance / maxLen) * 100);
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get value by path from object
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (key.includes('[') && key.includes(']')) {
        const [arrayKey, index] = key.split('[');
        const idx = parseInt(index.replace(']', ''));
        return current?.[arrayKey]?.[idx];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * Validate a rule against a value
   */
  private validateRule(
    rule: ScenarioFixture['validationRules'][0],
    actualValue: any
  ): boolean {
    switch (rule.operator) {
      case 'equals':
        return actualValue === rule.value;
      
      case 'contains':
        return String(actualValue).includes(String(rule.value));
      
      case 'regex':
        return new RegExp(rule.value).test(String(actualValue));
      
      case 'gt':
        return Number(actualValue) > Number(rule.value);
      
      case 'lt':
        return Number(actualValue) < Number(rule.value);
      
      case 'between':
        const num = Number(actualValue);
        return num >= Number(rule.value) && num <= Number(rule.value2);
      
      default:
        return false;
    }
  }

  /**
   * Enable/disable recording mode
   */
  setRecordingMode(enabled: boolean): void {
    this.recordingMode = enabled;
    logger.info(`Fixture recording mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if recording mode is enabled
   */
  isRecording(): boolean {
    return this.recordingMode;
  }

  /**
   * Clear fixture cache
   */
  clearCache(): void {
    this.fixtureCache.clear();
    this.scenarioCache.clear();
    this.pinnedInputs.clear();
  }
}

export const fixtureManagementService = FixtureManagementService.getInstance();