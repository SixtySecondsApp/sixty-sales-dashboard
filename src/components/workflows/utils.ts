import { 
  Target, 
  Activity, 
  Database, 
  GitBranch, 
  CheckSquare, 
  Bell, 
  Mail, 
  Clock, 
  Zap, 
  Users, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  Briefcase, 
  FileText, 
  Heart, 
  Plus, 
  Edit, 
  GitMerge, 
  Bot, 
  Sparkles 
} from 'lucide-react';
import { NodeExecutionState } from '@/lib/utils/workflowTestEngine';
import { NodeStatus } from './StatusIndicator';

// Icon mapping
export const iconMap: { [key: string]: any } = {
  Target,
  Activity,
  Database,
  GitBranch,
  CheckSquare,
  Bell,
  Mail,
  Clock,
  Zap,
  Users,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Briefcase,
  FileText,
  Heart,
  Plus,
  Edit,
  GitMerge,
  Bot,
  Sparkles
};

// Map legacy test status to new NodeStatus type
export const mapTestStatusToNodeStatus = (status: NodeExecutionState['status'] | undefined): NodeStatus => {
  switch (status) {
    case 'active': return 'processing';
    case 'success': return 'success';
    case 'failed': return 'failed';
    case 'skipped': return 'skipped';
    case 'waiting': return 'waiting';
    case 'idle': 
    default: return 'idle';
  }
};

