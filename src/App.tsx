import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { createApiMonitor } from '@/lib/utils/apiUtils';
import { API_BASE_URL } from '@/lib/config';
import PerformanceMonitor from '@/lib/utils/performanceMonitor';
import { AppLayout } from '@/components/AppLayout';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { CopilotProvider } from '@/lib/contexts/CopilotContext';
import { useInitializeAuditSession } from '@/lib/hooks/useAuditSession';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePerformanceOptimization } from '@/lib/hooks/usePerformanceOptimization';
import { IntelligentPreloader } from '@/components/LazyComponents';
import { webVitalsOptimizer } from '@/lib/utils/webVitals';
// Removed legacy migration import - stages are now handled via database migrations
import ErrorBoundary from '@/components/ErrorBoundary';
import logger from '@/lib/utils/logger';
import { StateProvider } from '@/lib/communication/StateManagement';
import { serviceWorkerManager, detectAndResolveCacheConflicts } from '@/lib/utils/serviceWorkerUtils';
import { VersionManager } from '@/components/VersionManager';
import { lazyWithRetry } from '@/lib/utils/dynamicImport';

// Use regular dashboard - optimization had issues
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/auth/login';
import TestGoogleTasks from '@/pages/TestGoogleTasks';
import MeetingThumbnail from '@/pages/MeetingThumbnail';
import BrowserlessTest from '@/pages/BrowserlessTest';

// Heavy routes - lazy load with retry mechanism to handle cache issues
const ActivityLog = lazyWithRetry(() => import('@/pages/ActivityLog'));
const Heatmap = lazyWithRetry(() => import('@/pages/Heatmap'));
const SalesFunnel = lazyWithRetry(() => import('@/pages/SalesFunnel'));
const Profile = lazyWithRetry(() => import('@/pages/Profile'));
const Calendar = lazyWithRetry(() => import('@/pages/Calendar'));

// Admin routes - lazy load with retry (infrequently accessed, more prone to cache issues)
const Users = lazyWithRetry(() => import('@/pages/admin/Users'));
const PipelineSettings = lazyWithRetry(() => import('@/pages/admin/PipelineSettings'));
const AuditLogs = lazyWithRetry(() => import('@/pages/admin/AuditLogs'));
const SmartTasksAdmin = lazyWithRetry(() => import('@/pages/SmartTasksAdmin'));
const PipelineAutomationAdmin = lazyWithRetry(() => import('@/pages/PipelineAutomationAdmin'));
// ApiTesting already imported below
const FunctionTesting = lazyWithRetry(() => import('@/pages/admin/FunctionTesting'));
const WorkflowsTestSuite = lazyWithRetry(() => import('@/components/admin/WorkflowsTestSuite'));
const WorkflowsE2ETestSuite = lazyWithRetry(() => import('@/components/admin/WorkflowsE2ETestSuite'));
const AIProviderSettings = lazyWithRetry(() => import('@/components/settings/AIProviderSettings'));
const GoogleIntegrationTests = lazyWithRetry(() => import('@/components/admin/GoogleIntegrationTests').then(m => ({ default: m.GoogleIntegrationTests })));
const SettingsSavvyCal = lazyWithRetry(() => import('@/pages/admin/SettingsSavvyCal'));
const SettingsBookingSources = lazyWithRetry(() => import('@/pages/admin/SettingsBookingSources'));
const SystemHealth = lazyWithRetry(() => import('@/pages/admin/SystemHealth'));
const Database = lazyWithRetry(() => import('@/pages/admin/Database'));
const Reports = lazyWithRetry(() => import('@/pages/admin/Reports'));
const Documentation = lazyWithRetry(() => import('@/pages/admin/Documentation'));
const HealthRules = lazyWithRetry(() => import('@/pages/admin/HealthRules'));

// Health Monitoring routes
const DealHealthDashboard = lazyWithRetry(() => import('@/components/DealHealthDashboard').then(m => ({ default: m.DealHealthDashboard })));

// Auth routes - lazy load with retry except login
const Signup = lazyWithRetry(() => import('@/pages/auth/signup'));
const ForgotPassword = lazyWithRetry(() => import('@/pages/auth/forgot-password'));
const ResetPassword = lazyWithRetry(() => import('@/pages/auth/reset-password'));

// Large feature routes - lazy load with retry (most prone to cache issues)
const PipelinePage = lazyWithRetry(() => import('@/pages/PipelinePage').then(module => ({ default: module.PipelinePage })));
const ActivityProcessingPage = lazyWithRetry(() => import('@/pages/ActivityProcessingPage'));
const TasksPage = lazyWithRetry(() => import('@/pages/TasksPage'));
const GoogleTasksSettings = lazyWithRetry(() => import('@/pages/GoogleTasksSettings'));
const Roadmap = lazyWithRetry(() => import('@/pages/Roadmap'));
const Releases = lazyWithRetry(() => import('@/pages/Releases'));
const Clients = lazyWithRetry(() => import('@/pages/Clients'));
const TestFallback = lazyWithRetry(() => import('@/pages/TestFallback'));
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage'));
const MeetingDetail = lazy(() => import('@/pages/MeetingDetail').then(m => ({ default: m.MeetingDetail })));
const DebugAuth = lazy(() => import('@/pages/DebugAuth'));
const DebugMeetings = lazy(() => import('@/pages/DebugMeetings'));
const ApiTesting = lazy(() => import('@/pages/ApiTesting'));
const TestNotifications = lazy(() => import('@/pages/TestNotifications'));
const Events = lazy(() => import('@/pages/Events'));

// CRM routes - heavy components, lazy load
const CRM = lazy(() => import('@/pages/CRM'));
const ElegantCRM = lazy(() => import('@/pages/ElegantCRM'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const Admin = lazy(() => import('@/pages/Admin')); // Keep for individual admin pages
const Insights = lazy(() => import('@/pages/Insights'));
const Workflows = lazy(() => import('@/pages/Workflows'));
const Integrations = lazy(() => import('@/pages/Integrations'));
const GoogleCallback = lazy(() => import('@/pages/GoogleCallback'));
const FathomCallback = lazy(() => import('@/pages/auth/FathomCallback'));
const FormDisplay = lazy(() => import('@/pages/FormDisplay'));
const CompaniesTable = lazy(() => import('@/pages/companies/CompaniesTable'));
const CompanyProfile = lazy(() => import('@/pages/companies/CompanyProfile'));
const ContactsTable = lazy(() => import('@/pages/contacts/ContactsTable'));
const ContactRecord = lazy(() => import('@/pages/contacts/ContactRecord'));
const DealRecord = lazy(() => import('@/pages/deals/DealRecord'));
const Email = lazy(() => import('@/pages/Email'));
const Preferences = lazy(() => import('@/pages/Preferences'));
const SettingsPage = lazyWithRetry(() => import('@/pages/Settings'));
const LeadsInbox = lazyWithRetry(() => import('@/pages/leads/LeadsInbox'));
const Copilot = lazyWithRetry(() => import('@/components/Copilot').then(m => ({ default: m.Copilot })));

// Note: CompaniesPage and ContactsPage removed - routes now redirect to CRM

// Loading component for better UX during code splitting
const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Make queryClient and service worker utilities globally available
declare global {
  interface Window {
    queryClient: QueryClient;
    detectAndResolveCacheConflicts?: typeof detectAndResolveCacheConflicts;
  }
}
window.queryClient = queryClient;

function App() {
  // Initialize performance optimizations
  const { performanceMetrics, measurePerformance, addCleanup } = usePerformanceOptimization({
    enableResourcePreloading: true,
    enableSmartPreloading: true,
    enableBundleMonitoring: true,
    enableMemoryCleanup: true,
    debugMode: process.env.NODE_ENV === 'development'
  });
  
  // Initialize API connection monitoring
  useEffect(() => {
    const monitor = createApiMonitor(API_BASE_URL, 30000); // Check every 30 seconds
    monitor.start();
    
    const cleanup = () => monitor.stop();
    addCleanup(cleanup);
    
    return cleanup;
  }, [addCleanup]);

  // Database migrations are now handled via Supabase migrations
  // Legacy runtime migrations have been removed to prevent API errors

  // Initialize performance monitoring
  useEffect(() => {
    const performanceMonitor = PerformanceMonitor.getInstance();
    
    // Enable performance monitoring in production for real user monitoring
    performanceMonitor.setEnabled(true);
    
    // Initialize Web Vitals optimization
    webVitalsOptimizer.initializeMonitoring(process.env.NODE_ENV === 'production');
    
    // Make service worker utilities globally available
    if (typeof window !== 'undefined') {
      window.detectAndResolveCacheConflicts = detectAndResolveCacheConflicts;
    }
    
    // Enhanced performance logging with optimization metrics
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        measurePerformance('performance-summary', () => {
          const summary = performanceMonitor.getPerformanceSummary();
          logger.log('📊 Performance Summary:', summary);
          logger.log('🚀 Optimization Metrics:', performanceMetrics);
        });
      }, 30000); // Every 30 seconds
      
      const cleanup = () => {
        clearInterval(interval);
        performanceMonitor.cleanup();
      };
      
      addCleanup(cleanup);
      return cleanup;
    }
    
    const cleanup = () => performanceMonitor.cleanup();
    addCleanup(cleanup);
    return cleanup;
  }, [measurePerformance, performanceMetrics, addCleanup]);

  return (
    <ErrorBoundary 
      onError={(error, errorInfo) => {
        logger.error('Application Error Boundary caught error:', error, errorInfo);
        // You could send this to your error reporting service here
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ViewModeProvider>
            <CopilotProvider>
              <StateProvider>
                <AppContent performanceMetrics={performanceMetrics} measurePerformance={measurePerformance} />
              </StateProvider>
            </CopilotProvider>
          </ViewModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Separate component that can use auth context
function AppContent({ performanceMetrics, measurePerformance }: any) {
  // Initialize audit session tracking - now inside AuthProvider
  useInitializeAuditSession();
  
  return (
    <>
      <IntelligentPreloader />
      <Routes>
        {/* Public pages for screenshot automation - MUST be outside ProtectedRoute */}
        <Route path="/meetings/thumbnail/:meetingId" element={<MeetingThumbnail />} />
        <Route path="/browserless-test" element={<BrowserlessTest />} />

        {/* Auth routes that should also be accessible without protection */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* All other routes wrapped in ProtectedRoute */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/debug-auth" element={<DebugAuth />} />
                <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
                <Route path="/copilot" element={<AppLayout><Copilot /></AppLayout>} />
                <Route path="/activity" element={<AppLayout><ActivityLog /></AppLayout>} />
                <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                <Route path="/crm" element={<AppLayout><ElegantCRM /></AppLayout>} />
                <Route path="/crm/elegant" element={<Navigate to="/crm" replace />} />
                {/* Admin Dashboard and Sections */}
                <Route path="/admin" element={<AppLayout><AdminDashboard /></AppLayout>} />
                <Route path="/admin/users" element={<AppLayout><Users /></AppLayout>} />
                <Route path="/admin/pipeline" element={<AppLayout><PipelineSettings /></AppLayout>} />
                <Route path="/admin/audit" element={<AppLayout><AuditLogs /></AppLayout>} />
                <Route path="/admin/smart-tasks" element={<AppLayout><SmartTasksAdmin /></AppLayout>} />
                <Route path="/admin/pipeline-automation" element={<AppLayout><PipelineAutomationAdmin /></AppLayout>} />
                <Route path="/admin/ai-settings" element={<AppLayout><AIProviderSettings /></AppLayout>} />
                <Route path="/admin/api-testing" element={<AppLayout><ApiTesting /></AppLayout>} />
                <Route path="/admin/function-testing" element={<AppLayout><FunctionTesting /></AppLayout>} />
                <Route path="/admin/workflows-test" element={<AppLayout><WorkflowsTestSuite /></AppLayout>} />
                <Route path="/admin/workflows-e2e" element={<AppLayout><WorkflowsE2ETestSuite /></AppLayout>} />
                <Route path="/admin/google-integration" element={<AppLayout><GoogleIntegrationTests /></AppLayout>} />
                <Route path="/admin/savvycal-settings" element={<AppLayout><SettingsSavvyCal /></AppLayout>} />
                <Route path="/admin/booking-sources" element={<AppLayout><SettingsBookingSources /></AppLayout>} />
                <Route path="/admin/system-health" element={<AppLayout><SystemHealth /></AppLayout>} />
                <Route path="/admin/database" element={<AppLayout><Database /></AppLayout>} />
                <Route path="/admin/reports" element={<AppLayout><Reports /></AppLayout>} />
                <Route path="/admin/documentation" element={<AppLayout><Documentation /></AppLayout>} />
                <Route path="/admin/health-rules" element={<AppLayout><HealthRules /></AppLayout>} />
                <Route path="/admin/old" element={<AppLayout><Admin /></AppLayout>} /> {/* Keep old admin for reference */}
                <Route path="/workflows" element={<AppLayout><Workflows /></AppLayout>} />
                <Route path="/integrations" element={<AppLayout><Integrations /></AppLayout>} />
                <Route path="/email" element={<AppLayout><Email /></AppLayout>} />
                <Route path="/auth/google/callback" element={<GoogleCallback />} />
                <Route path="/oauth/fathom/callback" element={<FathomCallback />} />
                <Route path="/pipeline" element={<AppLayout><PipelinePage /></AppLayout>} />
                <Route path="/tasks" element={<AppLayout><TasksPage /></AppLayout>} />
                <Route path="/crm/tasks" element={<AppLayout><TasksPage /></AppLayout>} />
                <Route path="/tasks/settings" element={<AppLayout><GoogleTasksSettings /></AppLayout>} />
                <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
                <Route path="/events" element={<AppLayout><Events /></AppLayout>} />
                <Route path="/leads" element={<AppLayout><LeadsInbox /></AppLayout>} />
                
                {/* Form Display Routes */}
                <Route path="/form/:formId" element={<Suspense fallback={<IntelligentPreloader />}><FormDisplay /></Suspense>} />
                <Route path="/form-test/:formId" element={<Suspense fallback={<IntelligentPreloader />}><FormDisplay /></Suspense>} />
                
                {/* Redirect to CRM with appropriate tab */}
                <Route path="/contacts" element={<Navigate to="/crm?tab=contacts" replace />} />
                <Route path="/companies" element={<Navigate to="/crm?tab=companies" replace />} />
                
                {/* Legacy routes for backward compatibility */}
                <Route path="/heatmap" element={<Navigate to="/insights" replace />} />
                <Route path="/funnel" element={<Navigate to="/insights" replace />} />
                <Route path="/activity-processing" element={<Navigate to="/activity" replace />} />
                {/* Legacy redirects */}
                <Route path="/api-testing" element={<Navigate to="/admin/api-testing" replace />} />
                <Route path="/admin/pipeline-settings" element={<Navigate to="/admin/pipeline" replace />} />
                <Route path="/admin/audit-logs" element={<Navigate to="/admin/audit" replace />} />
                <Route path="/crm/companies" element={<Navigate to="/crm" replace />} />
                <Route path="/crm/contacts" element={<Navigate to="/crm?tab=contacts" replace />} />
                
                {/* Individual record routes */}
                <Route path="/companies/:companyId" element={<AppLayout><CompanyProfile /></AppLayout>} />
                <Route path="/crm/companies/:companyId" element={<AppLayout><CompanyProfile /></AppLayout>} />
                <Route path="/crm/contacts/:id" element={<AppLayout><ContactRecord /></AppLayout>} />
                <Route path="/crm/deals/:id" element={<AppLayout><DealRecord /></AppLayout>} />
                <Route path="/crm/health" element={<AppLayout><DealHealthDashboard /></AppLayout>} />

                {/* Other routes */}
                <Route path="/payments" element={<Navigate to="/clients" replace />} />
                <Route path="/clients" element={<AppLayout><Clients /></AppLayout>} />
                <Route path="/subscriptions" element={<Navigate to="/clients" replace />} />
                <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
                <Route path="/preferences" element={<Navigate to="/settings" replace />} />
                <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
                <Route path="/roadmap" element={<AppLayout><Roadmap /></AppLayout>} />
                <Route path="/roadmap/ticket/:ticketId" element={<AppLayout><Roadmap /></AppLayout>} />
                <Route path="/releases" element={<AppLayout><Releases /></AppLayout>} />
                <Route path="/meetings" element={<AppLayout><MeetingsPage /></AppLayout>} />
                <Route path="/meetings/:id" element={<AppLayout><MeetingDetail /></AppLayout>} />
                <Route path="/debug-meetings" element={<AppLayout><DebugMeetings /></AppLayout>} />
                <Route path="/test-notifications" element={<AppLayout><TestNotifications /></AppLayout>} />
                <Route path="/test-fallback" element={<ProtectedRoute><TestFallback /></ProtectedRoute>} />
                <Route path="/test-google-tasks" element={<AppLayout><TestGoogleTasks /></AppLayout>} />
              </Routes>
            </Suspense>
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster />
      <VersionManager />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] pointer-events-none" />
    </>
  );
}

export default App;