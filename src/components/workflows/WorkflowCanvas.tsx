// Workflow Canvas Component - v2.1 with Visual Testing
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StatusIndicator, NodeStatus } from './StatusIndicator';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Handle,
  Position,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Save, 
  Play, 
  Settings,
  Target,
  Activity,
  CheckSquare,
  Bell,
  Mail,
  Database,
  GitBranch,
  Zap,
  ChevronRight,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Briefcase,
  FileText,
  Heart,
  Sparkles,
  X,
  Pause,
  Square,
  Search,
  Edit,
  Check,
  ChevronDown,
  Monitor,
  FlaskConical,
  GitMerge,
  Bot
} from 'lucide-react';
import { FaSlack } from 'react-icons/fa';
import { SlackConnectionButton } from '@/components/SlackConnectionButton';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { supabase } from '@/lib/supabase/clientV2';
import { WorkflowTestEngine, TestExecutionState, TEST_SCENARIOS, NodeExecutionState } from '@/lib/utils/workflowTestEngine';
import AnimatedTestEdge from './AnimatedTestEdge';
import WorkflowSaveModal from './WorkflowSaveModal';
import { WorkflowSuggestionGenerator } from '@/lib/utils/workflowSuggestions';
import AIAgentNode from './nodes/AIAgentNode';
import AIAgentConfigModal from './AIAgentConfigModal';
import type { AINodeConfig } from './AIAgentConfigModal';
import CustomGPTNode from './nodes/CustomGPTNode';
import CustomGPTConfigModal from './CustomGPTConfigModal';
import type { CustomGPTNodeConfig } from './CustomGPTConfigModal';
import AssistantManagerNode from './nodes/AssistantManagerNode';
import AssistantManagerConfigModal from './AssistantManagerConfigModal';
import type { AssistantManagerNodeConfig } from './AssistantManagerConfigModal';
import FormNode from './nodes/FormNode';
import GoogleEmailNode from './nodes/GoogleEmailNode';
import GoogleDocsNode from './nodes/GoogleDocsNode';
import FathomWebhookNode from './nodes/FathomWebhookNode';
import ConditionalBranchNode from './nodes/ConditionalBranchNode';
import GoogleDocsCreatorNode from './nodes/GoogleDocsCreatorNode';
import MeetingUpsertNode from './nodes/MeetingUpsertNode';
import ActionItemProcessorNode from './nodes/ActionItemProcessorNode';
import FreepikImageGenNode from './nodes/freepik/FreepikImageGenNode';
import FreepikUpscaleNode from './nodes/freepik/FreepikUpscaleNode';
import FreepikVideoGenNode from './nodes/freepik/FreepikVideoGenNode';
import type { FormField } from './nodes/FormNode';
import FormConfigModal from './FormConfigModal';
import FormPreview from './FormPreview';
import { formStorageService } from '@/lib/services/formStorageService';
import WorkflowTestMode from './WorkflowTestMode';
import ExecutionMonitor from './ExecutionMonitor';
import NodeExecutionModal from './NodeExecutionModal';
import { AIProviderService } from '@/lib/services/aiProvider';
import { createContextFromWorkflow } from '@/lib/utils/promptVariables';
import { formService } from '@/lib/services/formService';
import { workflowExecutionService } from '@/lib/services/workflowExecutionService';
import { useUsers } from '@/lib/hooks/useUsers';
import VariablePicker from './VariablePicker';
import LiveMonitorModal from './LiveMonitorModal';

import { TriggerNode } from './nodes/standard/TriggerNode';
import { ConditionNode } from './nodes/standard/ConditionNode';
import { ActionNode } from './nodes/standard/ActionNode';
import { RouterNode } from './nodes/standard/RouterNode';
import { iconMap } from './utils';
import { WorkflowNodeLibrary } from './components/WorkflowNodeLibrary';
import { LocalTestPanel } from './components/LocalTestPanel';
import { createWorkflowNode, calculateNodePosition } from './utils/nodeFactory';
import { nodeRegistry } from './utils/nodeRegistry';

// Base node types
const baseNodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  router: RouterNode,
  aiAgent: AIAgentNode,
  customGPT: CustomGPTNode,
  assistantManager: AssistantManagerNode,
  form: FormNode,
  googleEmail: GoogleEmailNode,
  googleDocs: GoogleDocsNode,
  fathomWebhook: FathomWebhookNode,
  conditionalBranch: ConditionalBranchNode,
  googleDocsCreator: GoogleDocsCreatorNode,
  meetingUpsert: MeetingUpsertNode,
  actionItemProcessor: ActionItemProcessorNode,
  freepikImageGen: FreepikImageGenNode,
  freepikUpscale: FreepikUpscaleNode,
  freepikVideoGen: FreepikVideoGenNode
};

// Merge with registered custom nodes
const nodeTypes: NodeTypes = {
  ...baseNodeTypes,
  ...nodeRegistry.getNodeTypes()
};

const edgeTypes = {
  animated: AnimatedTestEdge,
};
