/**
 * Path Discovery Algorithm
 *
 * Uses Depth-First Search (DFS) to find all unique paths through
 * a ProcessStructure from entry points to exit points.
 *
 * Entry points: Nodes with no incoming connections
 * Exit points: Nodes with no outgoing connections
 */

import type {
  ProcessStructure,
  ProcessNode,
  ProcessConnection,
  ScenarioPath,
  DecisionPoint,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Configuration
// ============================================================================

/** Maximum number of paths to discover (prevents combinatorial explosion) */
const MAX_PATHS = 50;

/** Maximum path length to prevent infinite loops */
const MAX_PATH_LENGTH = 100;

// ============================================================================
// Types
// ============================================================================

/**
 * Adjacency map for graph traversal
 * Maps node ID to array of outgoing connections
 */
type AdjacencyMap = Map<string, ProcessConnection[]>;

/**
 * Path discovery result
 */
export interface PathDiscoveryResult {
  /** All discovered paths */
  paths: ScenarioPath[];
  /** Entry points (nodes with no incoming edges) */
  entryPoints: string[];
  /** Exit points (nodes with no outgoing edges) */
  exitPoints: string[];
  /** Total unique branches (decision points) */
  totalBranches: number;
  /** Whether path limit was reached */
  truncated: boolean;
  /** Warning messages if any */
  warnings: string[];
}

/**
 * Internal path state during DFS
 */
interface PathState {
  stepIds: string[];
  decisions: DecisionPoint[];
  visited: Set<string>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build adjacency map from connections
 * Maps each node to its outgoing connections
 */
function buildAdjacencyMap(connections: ProcessConnection[]): AdjacencyMap {
  const adjacencyMap: AdjacencyMap = new Map();

  for (const conn of connections) {
    const existing = adjacencyMap.get(conn.from) || [];
    existing.push(conn);
    adjacencyMap.set(conn.from, existing);
  }

  return adjacencyMap;
}

/**
 * Find entry points (nodes with no incoming edges)
 */
function findEntryPoints(
  nodes: ProcessNode[],
  connections: ProcessConnection[]
): string[] {
  const hasIncoming = new Set<string>();

  for (const conn of connections) {
    hasIncoming.add(conn.to);
  }

  // Entry points are nodes that have no incoming connections
  // Prefer nodes with stepType 'trigger' if multiple entry points exist
  const entryPoints = nodes
    .filter((node) => !hasIncoming.has(node.id))
    .sort((a, b) => {
      // Prioritize triggers
      if (a.stepType === 'trigger' && b.stepType !== 'trigger') return -1;
      if (b.stepType === 'trigger' && a.stepType !== 'trigger') return 1;
      // Then by execution order
      return a.executionOrder - b.executionOrder;
    });

  return entryPoints.map((n) => n.id);
}

/**
 * Find exit points (nodes with no outgoing edges)
 */
function findExitPoints(
  nodes: ProcessNode[],
  connections: ProcessConnection[]
): string[] {
  const hasOutgoing = new Set<string>();

  for (const conn of connections) {
    hasOutgoing.add(conn.from);
  }

  // Exit points are nodes that have no outgoing connections
  const exitPoints = nodes
    .filter((node) => !hasOutgoing.has(node.id))
    .sort((a, b) => {
      // Sort by execution order (higher order = closer to end)
      return b.executionOrder - a.executionOrder;
    });

  return exitPoints.map((n) => n.id);
}

/**
 * Generate a hash for a path (used for deduplication)
 */
function generatePathHash(stepIds: string[]): string {
  return stepIds.join('|');
}

/**
 * Check if a node is a decision point (has multiple outgoing edges with labels)
 */
function isDecisionPoint(
  nodeId: string,
  adjacencyMap: AdjacencyMap,
  nodes: ProcessNode[]
): boolean {
  const outgoing = adjacencyMap.get(nodeId) || [];

  // A decision point has multiple outgoing edges
  if (outgoing.length <= 1) return false;

  // Check if node is marked as decision type
  const node = nodes.find((n) => n.id === nodeId);
  if (node?.shape === 'decision') return true;

  // Or if connections have condition labels
  return outgoing.some((conn) => conn.label);
}

// ============================================================================
// DFS Path Discovery
// ============================================================================

/**
 * Perform DFS to discover all paths from an entry point
 */
function discoverPathsDFS(
  startNodeId: string,
  exitPoints: Set<string>,
  adjacencyMap: AdjacencyMap,
  nodes: ProcessNode[],
  maxPaths: number
): ScenarioPath[] {
  const paths: ScenarioPath[] = [];
  const seenPaths = new Set<string>();

  // Stack for iterative DFS (avoids stack overflow for deep graphs)
  const stack: PathState[] = [
    {
      stepIds: [startNodeId],
      decisions: [],
      visited: new Set([startNodeId]),
    },
  ];

  while (stack.length > 0 && paths.length < maxPaths) {
    const current = stack.pop()!;
    const currentNodeId = current.stepIds[current.stepIds.length - 1];

    // Check if we've reached an exit point
    if (exitPoints.has(currentNodeId)) {
      const pathHash = generatePathHash(current.stepIds);

      // Only add if not seen before
      if (!seenPaths.has(pathHash)) {
        seenPaths.add(pathHash);
        paths.push({
          stepIds: [...current.stepIds],
          decisions: [...current.decisions],
          totalSteps: current.stepIds.length,
          pathHash,
        });
      }
      continue;
    }

    // Prevent infinite paths
    if (current.stepIds.length >= MAX_PATH_LENGTH) {
      continue;
    }

    // Get outgoing connections
    const outgoing = adjacencyMap.get(currentNodeId) || [];

    // If no outgoing edges and not an exit point, this is a dead end
    if (outgoing.length === 0) {
      // Still record the path if we reached here
      const pathHash = generatePathHash(current.stepIds);
      if (!seenPaths.has(pathHash)) {
        seenPaths.add(pathHash);
        paths.push({
          stepIds: [...current.stepIds],
          decisions: [...current.decisions],
          totalSteps: current.stepIds.length,
          pathHash,
        });
      }
      continue;
    }

    // Check if this is a decision point
    const isDecision = isDecisionPoint(currentNodeId, adjacencyMap, nodes);

    // Explore each outgoing edge
    for (const conn of outgoing) {
      const nextNodeId = conn.to;

      // Skip if already visited (prevents cycles)
      if (current.visited.has(nextNodeId)) {
        continue;
      }

      // Build new path state
      const newDecisions = [...current.decisions];

      // Record decision if this is a decision point
      if (isDecision && conn.label) {
        newDecisions.push({
          nodeId: currentNodeId,
          condition: conn.label,
          nextNodeId,
        });
      }

      // Push new state to stack
      stack.push({
        stepIds: [...current.stepIds, nextNodeId],
        decisions: newDecisions,
        visited: new Set([...current.visited, nextNodeId]),
      });
    }
  }

  return paths;
}

// ============================================================================
// Main Discovery Function
// ============================================================================

/**
 * Discover all unique paths through a ProcessStructure
 *
 * @param processStructure - The process structure to analyze
 * @param options - Optional configuration
 * @returns PathDiscoveryResult with all discovered paths
 */
export function discoverPaths(
  processStructure: ProcessStructure,
  options?: {
    maxPaths?: number;
    includePartialPaths?: boolean;
  }
): PathDiscoveryResult {
  const maxPaths = options?.maxPaths ?? MAX_PATHS;
  const warnings: string[] = [];

  const { nodes, connections } = processStructure;

  // Handle empty structure
  if (nodes.length === 0) {
    return {
      paths: [],
      entryPoints: [],
      exitPoints: [],
      totalBranches: 0,
      truncated: false,
      warnings: ['No nodes found in process structure'],
    };
  }

  // Build adjacency map
  const adjacencyMap = buildAdjacencyMap(connections);

  // Find entry and exit points
  const entryPoints = findEntryPoints(nodes, connections);
  const exitPoints = findExitPoints(nodes, connections);
  const exitPointSet = new Set(exitPoints);

  // Warn if no clear entry points
  if (entryPoints.length === 0) {
    warnings.push('No entry points found (nodes with no incoming edges)');
    // Fall back to first node by execution order
    const firstNode = [...nodes].sort((a, b) => a.executionOrder - b.executionOrder)[0];
    if (firstNode) {
      entryPoints.push(firstNode.id);
    }
  }

  // Warn if no clear exit points
  if (exitPoints.length === 0) {
    warnings.push('No exit points found (nodes with no outgoing edges)');
    // Fall back to last node by execution order
    const lastNode = [...nodes].sort((a, b) => b.executionOrder - a.executionOrder)[0];
    if (lastNode) {
      exitPointSet.add(lastNode.id);
    }
  }

  // Discover paths from each entry point
  const allPaths: ScenarioPath[] = [];
  const seenHashes = new Set<string>();

  for (const entryPoint of entryPoints) {
    if (allPaths.length >= maxPaths) break;

    const paths = discoverPathsDFS(
      entryPoint,
      exitPointSet,
      adjacencyMap,
      nodes,
      maxPaths - allPaths.length
    );

    for (const path of paths) {
      if (!seenHashes.has(path.pathHash)) {
        seenHashes.add(path.pathHash);
        allPaths.push(path);
      }
    }
  }

  // Count total branches (unique decision points)
  const branchNodeIds = new Set<string>();
  for (const path of allPaths) {
    for (const decision of path.decisions) {
      branchNodeIds.add(decision.nodeId);
    }
  }

  // Also count nodes with multiple outgoing edges
  for (const nodeId of adjacencyMap.keys()) {
    const outgoing = adjacencyMap.get(nodeId) || [];
    if (outgoing.length > 1) {
      branchNodeIds.add(nodeId);
    }
  }

  const truncated = allPaths.length >= maxPaths;
  if (truncated) {
    warnings.push(`Path limit reached (${maxPaths}). Some paths may not be discovered.`);
  }

  return {
    paths: allPaths,
    entryPoints,
    exitPoints,
    totalBranches: branchNodeIds.size,
    truncated,
    warnings,
  };
}

/**
 * Get the primary/happy path through the structure
 * This is typically the first path discovered or the one with the most steps
 */
export function getHappyPath(
  processStructure: ProcessStructure
): ScenarioPath | null {
  const result = discoverPaths(processStructure, { maxPaths: 10 });

  if (result.paths.length === 0) {
    return null;
  }

  // Prefer the path that follows the main execution order
  // (fewest decision deviations, or the longest complete path)
  const sortedPaths = [...result.paths].sort((a, b) => {
    // First, prefer paths with fewer decision points (more "straight" path)
    const decisionDiff = a.decisions.length - b.decisions.length;
    if (decisionDiff !== 0) return decisionDiff;

    // Then prefer longer paths (more complete)
    return b.totalSteps - a.totalSteps;
  });

  return sortedPaths[0];
}

/**
 * Get all branch paths (paths that include at least one decision)
 */
export function getBranchPaths(
  processStructure: ProcessStructure
): ScenarioPath[] {
  const result = discoverPaths(processStructure);

  return result.paths.filter((path) => path.decisions.length > 0);
}

/**
 * Get integrations used along a specific path
 */
export function getPathIntegrations(
  path: ScenarioPath,
  nodes: ProcessNode[]
): string[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const integrations = new Set<string>();

  for (const stepId of path.stepIds) {
    const node = nodeMap.get(stepId);
    if (node?.integration) {
      integrations.add(node.integration.toLowerCase());
    }
  }

  return Array.from(integrations);
}
