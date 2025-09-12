import { useNavigate } from 'react-router-dom';
import { 
  UsersIcon, 
  PanelLeft, 
  Shield, 
  Zap, 
  Code2,
  Target,
  Workflow,
  TestTube,
  FlaskConical,
  Sparkles,
  Settings,
  ChevronRight,
  Activity,
  Database,
  FileText,
  BarChart3
} from 'lucide-react';

interface AdminCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  category: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const adminCards: AdminCard[] = [
    // User Management
    {
      id: 'users',
      title: 'Users',
      description: 'Manage user accounts, permissions, and access control',
      icon: <UsersIcon className="w-6 h-6" />,
      path: '/admin/users',
      color: 'from-blue-500 to-blue-600',
      category: 'User Management'
    },
    {
      id: 'audit',
      title: 'Audit Logs',
      description: 'View system activity, user actions, and security events',
      icon: <Shield className="w-6 h-6" />,
      path: '/admin/audit',
      color: 'from-purple-500 to-purple-600',
      category: 'Security'
    },

    // Pipeline & CRM
    {
      id: 'pipeline',
      title: 'Pipeline Settings',
      description: 'Configure sales pipeline stages, automation rules, and workflows',
      icon: <PanelLeft className="w-6 h-6" />,
      path: '/admin/pipeline',
      color: 'from-green-500 to-green-600',
      category: 'CRM Configuration'
    },
    {
      id: 'smart-tasks',
      title: 'Smart Tasks',
      description: 'Manage automated task templates and intelligent triggers',
      icon: <Zap className="w-6 h-6" />,
      path: '/admin/smart-tasks',
      color: 'from-yellow-500 to-yellow-600',
      category: 'Automation'
    },
    {
      id: 'pipeline-automation',
      title: 'Pipeline Automation',
      description: 'Set up automated pipeline transitions and workflow rules',
      icon: <Workflow className="w-6 h-6" />,
      path: '/admin/pipeline-automation',
      color: 'from-indigo-500 to-indigo-600',
      category: 'Automation'
    },

    // AI & Integrations
    {
      id: 'ai-settings',
      title: 'AI Settings',
      description: 'Configure AI providers, models, and intelligent features',
      icon: <Sparkles className="w-6 h-6" />,
      path: '/admin/ai-settings',
      color: 'from-pink-500 to-pink-600',
      category: 'AI & Intelligence'
    },

    // Testing & Development
    {
      id: 'api-testing',
      title: 'API Testing',
      description: 'Test API endpoints, monitor performance, and debug issues',
      icon: <Code2 className="w-6 h-6" />,
      path: '/admin/api-testing',
      color: 'from-cyan-500 to-cyan-600',
      category: 'Development'
    },
    {
      id: 'function-testing',
      title: 'Function Testing',
      description: 'Test edge functions, serverless endpoints, and webhooks',
      icon: <Target className="w-6 h-6" />,
      path: '/admin/function-testing',
      color: 'from-orange-500 to-orange-600',
      category: 'Development'
    },
    {
      id: 'workflows-test',
      title: 'Workflows Test Suite',
      description: 'Run comprehensive workflow tests and validations',
      icon: <TestTube className="w-6 h-6" />,
      path: '/admin/workflows-test',
      color: 'from-teal-500 to-teal-600',
      category: 'Testing'
    },
    {
      id: 'workflows-e2e',
      title: 'E2E Tests',
      description: 'Execute end-to-end tests for critical user journeys',
      icon: <FlaskConical className="w-6 h-6" />,
      path: '/admin/workflows-e2e',
      color: 'from-red-500 to-red-600',
      category: 'Testing'
    },
    {
      id: 'google-integration',
      title: 'Google Integration Tests',
      description: 'Test Google Calendar, Gmail, and OAuth integrations',
      icon: <Settings className="w-6 h-6" />,
      path: '/admin/google-integration',
      color: 'from-amber-500 to-amber-600',
      category: 'Integrations'
    },

    // System & Monitoring
    {
      id: 'system-health',
      title: 'System Health',
      description: 'Monitor system performance, resources, and uptime',
      icon: <Activity className="w-6 h-6" />,
      path: '/admin/system-health',
      color: 'from-emerald-500 to-emerald-600',
      category: 'Monitoring'
    },
    {
      id: 'database',
      title: 'Database',
      description: 'Manage database connections, migrations, and backups',
      icon: <Database className="w-6 h-6" />,
      path: '/admin/database',
      color: 'from-slate-500 to-slate-600',
      category: 'Infrastructure'
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Generate and schedule system reports and analytics',
      icon: <BarChart3 className="w-6 h-6" />,
      path: '/admin/reports',
      color: 'from-violet-500 to-violet-600',
      category: 'Analytics'
    },
    {
      id: 'documentation',
      title: 'Documentation',
      description: 'Access system documentation and API references',
      icon: <FileText className="w-6 h-6" />,
      path: '/admin/documentation',
      color: 'from-stone-500 to-stone-600',
      category: 'Resources'
    }
  ];

  // Group cards by category
  const groupedCards = adminCards.reduce((acc, card) => {
    if (!acc[card.category]) {
      acc[card.category] = [];
    }
    acc[card.category].push(card);
    return acc;
  }, {} as Record<string, AdminCard[]>);

  const categoryOrder = [
    'User Management',
    'Security',
    'CRM Configuration',
    'Automation',
    'AI & Intelligence',
    'Integrations',
    'Development',
    'Testing',
    'Monitoring',
    'Infrastructure',
    'Analytics',
    'Resources'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Administration</h1>
            <p className="text-lg text-gray-400">
              Manage your system settings, users, and configurations
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-white">124</p>
                </div>
                <UsersIcon className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Workflows</p>
                  <p className="text-2xl font-bold text-white">18</p>
                </div>
                <Workflow className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">System Health</p>
                  <p className="text-2xl font-bold text-white">98%</p>
                </div>
                <Activity className="w-8 h-8 text-emerald-400 opacity-50" />
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">API Calls Today</p>
                  <p className="text-2xl font-bold text-white">2.4K</p>
                </div>
                <Code2 className="w-8 h-8 text-cyan-400 opacity-50" />
              </div>
            </div>
          </div>

          {/* Admin Cards by Category */}
          <div className="space-y-8">
            {categoryOrder.map(category => {
              const cards = groupedCards[category];
              if (!cards || cards.length === 0) return null;

              return (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-gray-300 mb-4">{category}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => navigate(card.path)}
                        className="group relative overflow-hidden bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 hover:bg-gray-800/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl text-left"
                      >
                        {/* Gradient Background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-10 transition-opacity duration-200`} />
                        
                        {/* Content */}
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-lg bg-gradient-to-br ${card.color} bg-opacity-10`}>
                              <div className="text-white">
                                {card.icon}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors transform group-hover:translate-x-1 duration-200" />
                          </div>
                          
                          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white transition-colors">
                            {card.title}
                          </h3>
                          
                          <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors line-clamp-2">
                            {card.description}
                          </p>
                        </div>

                        {/* Hover Border Glow */}
                        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300 pointer-events-none`} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}