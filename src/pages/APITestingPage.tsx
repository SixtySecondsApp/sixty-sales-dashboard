import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CodeEditor } from '@/components/ui/code-editor'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  Code2,
  Play,
  Copy,
  Trash2,
  Plus,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Search,
  Filter,
  Settings,
  Terminal,
  Zap,
  Server,
  Database,
  Users,
  Save,
  FolderOpen,
  History,
  BookOpen
} from 'lucide-react'

// Types
interface APIKey {
  id: string
  name: string
  key: string
  permissions: string[]
  rateLimitPerMinute: number
  createdAt: string
  lastUsed: string | null
  usage: {
    requestsToday: number
    requestsThisMonth: number
  }
}

interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  endpoint: string
  headers: Record<string, string>
  body: string
  queryParams: Record<string, string>
}

interface APIResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  responseTime: number
  size: number
}

interface ExampleRequest {
  id: string
  name: string
  category: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  endpoint: string
  headers: Record<string, string>
  body?: string
  queryParams?: Record<string, string>
}

interface RequestTemplate {
  id: string
  name: string
  description: string
  request: APIRequest
  createdAt: string
  lastModified: string
}

interface RequestHistory {
  id: string
  request: APIRequest
  response: APIResponse
  timestamp: string
  duration: number
}

// Sample data
const sampleAPIKeys: APIKey[] = [
  {
    id: '1',
    name: 'Development Key',
    key: 'sk_dev_1234567890abcdef',
    permissions: ['read', 'write'],
    rateLimitPerMinute: 60,
    createdAt: '2024-01-15T10:00:00Z',
    lastUsed: '2024-01-20T14:30:00Z',
    usage: {
      requestsToday: 45,
      requestsThisMonth: 1250
    }
  },
  {
    id: '2',
    name: 'Production Key',
    key: 'sk_prod_abcdef1234567890',
    permissions: ['read'],
    rateLimitPerMinute: 100,
    createdAt: '2024-01-01T08:00:00Z',
    lastUsed: '2024-01-20T16:45:00Z',
    usage: {
      requestsToday: 89,
      requestsThisMonth: 3420
    }
  }
]

const exampleRequests: ExampleRequest[] = [
  {
    id: '1',
    name: 'Get All Deals',
    category: 'Deals',
    description: 'Retrieve all deals with pagination',
    method: 'GET',
    endpoint: '/api/deals',
    headers: { 'Authorization': 'Bearer {your_token}' },
    queryParams: { 'page': '1', 'limit': '20' }
  },
  {
    id: '2',
    name: 'Create New Deal',
    category: 'Deals',
    description: 'Create a new deal record',
    method: 'POST',
    endpoint: '/api/deals',
    headers: { 
      'Authorization': 'Bearer {your_token}',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'New Deal',
      value: 5000,
      stage: 'proposal',
      company_id: '123'
    }, null, 2)
  },
  {
    id: '3',
    name: 'Get User Profile',
    category: 'Users',
    description: 'Get authenticated user information',
    method: 'GET',
    endpoint: '/api/user/profile',
    headers: { 'Authorization': 'Bearer {your_token}' }
  },
  {
    id: '4',
    name: 'Update Activity',
    category: 'Activities',
    description: 'Update an existing activity',
    method: 'PUT',
    endpoint: '/api/activities/{id}',
    headers: { 
      'Authorization': 'Bearer {your_token}',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'call',
      notes: 'Updated call notes',
      completed: true
    }, null, 2)
  }
]

// Helper functions
const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-emerald-400'
  if (status >= 300 && status < 400) return 'text-blue-400'
  if (status >= 400 && status < 500) return 'text-amber-400'
  return 'text-red-400'
}

const getStatusBadgeVariant = (status: number) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'default'
  if (status >= 400 && status < 500) return 'secondary'
  return 'destructive'
}

const formatTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Stat Card Component
const StatCard: React.FC<{ 
  title: string
  value: string
  sub?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}> = ({ title, value, sub, icon, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    whileHover={{ scale: 1.02, y: -2 }}
    className="relative overflow-hidden bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-2xl p-4 border border-gray-800/50 shadow-lg hover:shadow-xl hover:border-gray-700/60 transition-all duration-300 group"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</div>
        <div className="text-2xl font-bold text-gray-100">{value}</div>
        {sub && (
          <div className={cn(
            "text-xs font-medium",
            trend === 'up' ? 'text-emerald-400' : 
            trend === 'down' ? 'text-red-400' : 
            'text-gray-500'
          )}>
            {sub}
          </div>
        )}
      </div>
      {icon && (
        <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
          {icon}
        </div>
      )}
    </div>
  </motion.div>
)

const APITestingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('request-builder')
  const [apiKeys, setApiKeys] = useState<APIKey[]>(sampleAPIKeys)
  const [request, setRequest] = useState<APIRequest>({
    method: 'GET',
    endpoint: '/api/deals',
    headers: { 'Authorization': 'Bearer {your_token}' },
    body: '',
    queryParams: {}
  })
  const [response, setResponse] = useState<APIResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [requestTemplates, setRequestTemplates] = useState<RequestTemplate[]>([])
  const [requestHistory, setRequestHistory] = useState<RequestHistory[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  // Filter examples based on search and category
  const filteredExamples = exampleRequests.filter(example => {
    const matchesSearch = example.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         example.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || example.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(exampleRequests.map(req => req.category))]

  const loadExample = (example: ExampleRequest) => {
    setRequest({
      method: example.method,
      endpoint: example.endpoint,
      headers: example.headers,
      body: example.body || '',
      queryParams: example.queryParams || {}
    })
    setActiveTab('request-builder')
  }

  const executeRequest = async () => {
    setLoading(true)
    const startTime = Date.now()
    
    // Simulate API request
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200))
    
    // Mock response based on request
    const mockResponse: APIResponse = {
      status: request.method === 'POST' ? 201 : 200,
      statusText: request.method === 'POST' ? 'Created' : 'OK',
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '58',
        'x-ratelimit-reset': '1640995200'
      },
      body: JSON.stringify({
        success: true,
        data: request.method === 'GET' ? [
          { id: 1, title: 'Deal 1', value: 5000 },
          { id: 2, title: 'Deal 2', value: 7500 }
        ] : { id: 123, created: true },
        message: `${request.method} request successful`
      }, null, 2),
      responseTime: 234 + Math.random() * 500,
      size: 1024 + Math.random() * 2048
    }
    
    // Add to history
    const historyEntry: RequestHistory = {
      id: Date.now().toString(),
      request: { ...request },
      response: mockResponse,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    }
    setRequestHistory(prev => [historyEntry, ...prev.slice(0, 49)]) // Keep last 50
    
    setResponse(mockResponse)
    setLoading(false)
  }

  const saveAsTemplate = () => {
    if (templateName.trim()) {
      const template: RequestTemplate = {
        id: Date.now().toString(),
        name: templateName.trim(),
        description: templateDescription.trim(),
        request: { ...request },
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
      setRequestTemplates(prev => [...prev, template])
      setShowSaveDialog(false)
      setTemplateName('')
      setTemplateDescription('')
    }
  }

  const loadTemplate = (template: RequestTemplate) => {
    setRequest(template.request)
    setActiveTab('request-builder')
  }

  const loadFromHistory = (historyEntry: RequestHistory) => {
    setRequest(historyEntry.request)
    setResponse(historyEntry.response)
    setActiveTab('request-builder')
  }

  const generateCurlCommand = () => {
    let curl = `curl -X ${request.method} '${request.endpoint}'`
    
    Object.entries(request.headers).forEach(([key, value]) => {
      curl += ` \\\n  -H '${key}: ${value}'`
    })
    
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      curl += ` \\\n  -d '${request.body}'`
    }
    
    return curl
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const generateApiKey = () => {
    const newKey: APIKey = {
      id: Date.now().toString(),
      name: `API Key ${Date.now()}`,
      key: `sk_${Math.random().toString(36).substr(2, 20)}`,
      permissions: ['read'],
      rateLimitPerMinute: 60,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      usage: {
        requestsToday: 0,
        requestsThisMonth: 0
      }
    }
    setApiKeys([...apiKeys, newKey])
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 backdrop-blur-sm rounded-xl border border-emerald-500/20">
            <Code2 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent">
              API Testing
            </h1>
            <p className="text-sm text-gray-400 mt-1">Test and explore your CRM API endpoints</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          title="API Keys" 
          value={apiKeys.length.toString()}
          icon={<Key className="h-5 w-5" />}
          trend="neutral"
        />
        <StatCard 
          title="Requests Today" 
          value="134"
          sub="+12% from yesterday"
          icon={<Server className="h-5 w-5" />}
          trend="up"
        />
        <StatCard 
          title="Avg Response" 
          value="245ms"
          sub="Within SLA"
          icon={<Zap className="h-5 w-5" />}
          trend="neutral"
        />
        <StatCard 
          title="Success Rate" 
          value="99.2%"
          sub="Last 30 days"
          icon={<CheckCircle className="h-5 w-5" />}
          trend="up"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Examples Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-gray-900/70 to-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-xl sticky top-6"
          >
            <div className="p-4 border-b border-gray-800/50">
              <h3 className="font-semibold text-gray-200 mb-3">Example Requests</h3>
              
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search examples..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-500"
                />
              </div>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={selectedCategory === '' ? 'default' : 'ghost'}
                  onClick={() => setSelectedCategory('')}
                  className="text-xs h-7"
                >
                  All
                </Button>
                {categories.map(category => (
                  <Button
                    key={category}
                    size="sm"
                    variant={selectedCategory === category ? 'default' : 'ghost'}
                    onClick={() => setSelectedCategory(category)}
                    className="text-xs h-7"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="p-2 max-h-96 overflow-y-auto">
              {filteredExamples.map((example, index) => (
                <motion.button
                  key={example.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => loadExample(example)}
                  className="w-full text-left p-3 rounded-xl hover:bg-gray-800/50 transition-colors group mb-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs border-0 font-mono",
                            example.method === 'GET' && 'bg-blue-500/20 text-blue-400',
                            example.method === 'POST' && 'bg-green-500/20 text-green-400',
                            example.method === 'PUT' && 'bg-amber-500/20 text-amber-400',
                            example.method === 'DELETE' && 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {example.method}
                        </Badge>
                        <span className="text-xs text-gray-500">{example.category}</span>
                      </div>
                      <div className="font-medium text-sm text-gray-200 group-hover:text-emerald-400 transition-colors truncate">
                        {example.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {example.description}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Main Panel */}
        <div className="col-span-12 lg:col-span-9">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-900/70 to-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-xl overflow-hidden"
          >
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-gray-800/50">
                <TabsList className="bg-transparent border-0 p-4 gap-2 flex-wrap">
                  <TabsTrigger 
                    value="request-builder"
                    className="bg-gray-800/50 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 border border-gray-700/50 data-[state=active]:border-emerald-500/50"
                  >
                    <Terminal className="h-4 w-4 mr-2" />
                    Request Builder
                  </TabsTrigger>
                  <TabsTrigger 
                    value="templates"
                    className="bg-gray-800/50 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 border border-gray-700/50 data-[state=active]:border-emerald-500/50"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Templates
                  </TabsTrigger>
                  <TabsTrigger 
                    value="history"
                    className="bg-gray-800/50 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 border border-gray-700/50 data-[state=active]:border-emerald-500/50"
                  >
                    <History className="h-4 w-4 mr-2" />
                    History
                  </TabsTrigger>
                  <TabsTrigger 
                    value="api-keys"
                    className="bg-gray-800/50 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 border border-gray-700/50 data-[state=active]:border-emerald-500/50"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    API Keys
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="request-builder" className="p-6 space-y-6">
                {/* Header with Save Button */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-200">Request Builder</h3>
                  <Button 
                    onClick={() => setShowSaveDialog(true)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Template
                  </Button>
                </div>

                {/* Request Builder */}
                <div className="space-y-4">
                  {/* Method and URL */}
                  <div className="flex gap-3">
                    <select
                      value={request.method}
                      onChange={(e) => setRequest({...request, method: e.target.value as any})}
                      className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-200 font-mono text-sm min-w-[100px]"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    
                    <Input
                      placeholder="https://api.example.com/endpoint"
                      value={request.endpoint}
                      onChange={(e) => setRequest({...request, endpoint: e.target.value})}
                      className="flex-1 bg-gray-800/50 border-gray-700/50 text-gray-200 font-mono"
                    />
                    
                    <Button
                      onClick={executeRequest}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                    >
                      {loading ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Send
                    </Button>
                  </div>

                  {/* Headers */}
                  <div>
                    <CodeEditor
                      title="Request Headers"
                      language="json"
                      value={JSON.stringify(request.headers, null, 2)}
                      onChange={(value) => {
                        try {
                          const parsed = JSON.parse(value)
                          setRequest({...request, headers: parsed})
                        } catch {
                          // Keep editing invalid JSON
                        }
                      }}
                      placeholder='{"Authorization": "Bearer your_token", "Content-Type": "application/json"}'
                      minHeight={120}
                      maxHeight={200}
                      showValidation={true}
                      showCopyButton={true}
                    />
                  </div>

                  {/* Body (for POST/PUT) */}
                  {['POST', 'PUT', 'PATCH'].includes(request.method) && (
                    <div>
                      <CodeEditor
                        title="Request Body"
                        language="json"
                        value={request.body}
                        onChange={(value) => setRequest({...request, body: value})}
                        placeholder='{"key": "value"}'
                        minHeight={160}
                        maxHeight={300}
                        showValidation={true}
                        showCopyButton={true}
                      />
                    </div>
                  )}
                </div>

                {/* Response Section */}
                {response && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t border-gray-800/50 pt-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-200">Response</h3>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={getStatusBadgeVariant(response.status) as any}
                          className="font-mono"
                        >
                          {response.status} {response.statusText}
                        </Badge>
                        <span className="text-sm text-gray-400">
                          {formatTime(response.responseTime)}
                        </span>
                        <span className="text-sm text-gray-400">
                          {formatSize(response.size)}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(response.body)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <CodeEditor
                      title="Response Body"
                      language="json"
                      value={response.body}
                      onChange={() => {}} // Read-only
                      readOnly={true}
                      minHeight={200}
                      maxHeight={400}
                      showCopyButton={true}
                    />
                  </motion.div>
                )}

                {/* cURL Command */}
                <div className="border-t border-gray-800/50 pt-6">
                  <CodeEditor
                    title="cURL Command"
                    language="curl"
                    value={generateCurlCommand()}
                    onChange={() => {}} // Read-only
                    readOnly={true}
                    minHeight={120}
                    maxHeight={200}
                    showCopyButton={true}
                  />
                </div>
              </TabsContent>

              <TabsContent value="templates" className="p-6">
                <div className="space-y-6">
                  {/* Templates Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-200">Request Templates</h3>
                    <div className="text-sm text-gray-400">
                      {requestTemplates.length} templates
                    </div>
                  </div>

                  {/* Templates Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {requestTemplates.map((template) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className="bg-gradient-to-br from-gray-900/70 to-gray-900/40 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 hover:border-gray-700/60 transition-all duration-300 shadow-lg hover:shadow-xl group cursor-pointer"
                        onClick={() => loadTemplate(template)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs border-0 font-mono",
                              template.request.method === 'GET' && 'bg-blue-500/20 text-blue-400',
                              template.request.method === 'POST' && 'bg-green-500/20 text-green-400',
                              template.request.method === 'PUT' && 'bg-amber-500/20 text-amber-400',
                              template.request.method === 'DELETE' && 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {template.request.method}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Delete template
                              setRequestTemplates(prev => prev.filter(t => t.id !== template.id))
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                        
                        <h4 className="font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors mb-1">
                          {template.name}
                        </h4>
                        
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {template.description || 'No description'}
                        </p>
                        
                        <div className="text-xs text-gray-500 font-mono bg-gray-800/50 rounded px-2 py-1 mb-3 truncate">
                          {template.request.endpoint}
                        </div>
                        
                        <div className="text-xs text-gray-500 flex items-center justify-between">
                          <span>
                            {new Date(template.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            Load
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Empty State */}
                  {requestTemplates.length === 0 && (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-300 mb-2">No templates yet</h4>
                      <p className="text-gray-500 mb-4">Save your frequently used requests as templates for quick access.</p>
                      <Button 
                        onClick={() => setShowSaveDialog(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Create First Template
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="p-6">
                <div className="space-y-6">
                  {/* History Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-200">Request History</h3>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-400">
                        {requestHistory.length} requests
                      </div>
                      {requestHistory.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRequestHistory([])}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear History
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* History List */}
                  <div className="space-y-3">
                    {requestHistory.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gradient-to-br from-gray-900/70 to-gray-900/40 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 hover:border-gray-700/60 transition-all duration-300 shadow-lg hover:shadow-xl group cursor-pointer"
                        onClick={() => loadFromHistory(entry)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs border-0 font-mono",
                                entry.request.method === 'GET' && 'bg-blue-500/20 text-blue-400',
                                entry.request.method === 'POST' && 'bg-green-500/20 text-green-400',
                                entry.request.method === 'PUT' && 'bg-amber-500/20 text-amber-400',
                                entry.request.method === 'DELETE' && 'bg-red-500/20 text-red-400'
                              )}
                            >
                              {entry.request.method}
                            </Badge>
                            <Badge 
                              variant={getStatusBadgeVariant(entry.response.status) as any}
                              className="text-xs"
                            >
                              {entry.response.status}
                            </Badge>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(entry.response.responseTime)}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="font-mono text-sm text-gray-300 group-hover:text-emerald-400 transition-colors truncate">
                          {entry.request.endpoint}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Empty State */}
                  {requestHistory.length === 0 && (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-300 mb-2">No requests yet</h4>
                      <p className="text-gray-500">Your request history will appear here after you execute API calls.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="api-keys" className="p-6">
                <div className="space-y-6">
                  {/* API Keys Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-200">Manage API Keys</h3>
                    <Button onClick={generateApiKey} className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Key
                    </Button>
                  </div>

                  {/* API Keys Table */}
                  <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800/50 hover:bg-gray-800/20">
                          <TableHead className="text-gray-400">Name</TableHead>
                          <TableHead className="text-gray-400">Key</TableHead>
                          <TableHead className="text-gray-400">Permissions</TableHead>
                          <TableHead className="text-gray-400">Rate Limit</TableHead>
                          <TableHead className="text-gray-400">Usage Today</TableHead>
                          <TableHead className="text-gray-400">Last Used</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((apiKey) => (
                          <TableRow key={apiKey.id} className="border-gray-800/50 hover:bg-gray-800/20">
                            <TableCell className="font-medium text-gray-200">
                              {apiKey.name}
                            </TableCell>
                            <TableCell className="font-mono text-gray-400">
                              <div className="flex items-center gap-2">
                                <code className="bg-gray-800/50 px-2 py-1 rounded text-xs">
                                  {apiKey.key.substring(0, 12)}...
                                </code>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => copyToClipboard(apiKey.key)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {apiKey.permissions.map(permission => (
                                  <Badge key={permission} variant="secondary" className="text-xs">
                                    {permission}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {apiKey.rateLimitPerMinute}/min
                            </TableCell>
                            <TableCell className="text-gray-400">
                              <div className="flex items-center gap-2">
                                <span>{apiKey.usage.requestsToday}</span>
                                <div className="w-16 bg-gray-800 rounded-full h-2">
                                  <div 
                                    className="bg-emerald-500 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min((apiKey.usage.requestsToday / apiKey.rateLimitPerMinute) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* Save Template Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-gray-900/95 to-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-200">Save as Template</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSaveDialog(false)}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-300"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Template Name *
                  </label>
                  <Input
                    placeholder="e.g., Get User Profile"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="bg-gray-800/50 border-gray-700/50 text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (optional)
                  </label>
                  <Textarea
                    placeholder="Brief description of what this request does..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="bg-gray-800/50 border-gray-700/50 text-gray-200 resize-none"
                    rows={3}
                  />
                </div>
                
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800/50">
                  <div className="text-xs text-gray-400 mb-2">Request Preview:</div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs border-0 font-mono",
                        request.method === 'GET' && 'bg-blue-500/20 text-blue-400',
                        request.method === 'POST' && 'bg-green-500/20 text-green-400',
                        request.method === 'PUT' && 'bg-amber-500/20 text-amber-400',
                        request.method === 'DELETE' && 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {request.method}
                    </Badge>
                    <code className="text-xs text-gray-300 font-mono truncate">
                      {request.endpoint}
                    </code>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowSaveDialog(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveAsTemplate}
                  disabled={!templateName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default APITestingPage