import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { createApiMonitor } from '@/lib/utils/apiUtils';
import { API_BASE_URL } from '@/lib/config';
import PerformanceMonitor from '@/lib/utils/performanceMonitor';
import { AppLayout } from '@/components/AppLayout';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { OrgProvider } from '@/lib/contexts/OrgContext';
import { UserPermissionsProvider } from '@/contexts/UserPermissionsContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { CopilotProvider } from '@/lib/contexts/CopilotContext';
import { useInitializeAuditSession } from '@/lib/hooks/useAuditSession';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { InternalRouteGuard, AdminRouteGuard } from '@/components/RouteGuard';
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
import AuthCallback from '@/pages/auth/AuthCallback';
import AcceptInvitation from '@/pages/auth/AcceptInvitation';
import TestGoogleTasks from '@/pages/TestGoogleTasks';
import MeetingThumbnail from '@/pages/MeetingThumbnail';
import BrowserlessTest from '@/pages/BrowserlessTest';
import PublicProposal from '@/pages/PublicProposal';
import MeetingsLanding from '@/product-pages/meetings/MeetingsLanding';

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
const LogoSettings = lazyWithRetry(() => import('@/pages/settings/LogoSettings'));

// Health Monitoring routes
const DealHealthDashboard = lazyWithRetry(() => import('@/components/DealHealthDashboard').then(m => ({ default: m.DealHealthDashboard })));
const RelationshipHealth = lazyWithRetry(() => import('@/pages/RelationshipHealth'));
const HealthMonitoring = lazyWithRetry(() => import('@/pages/HealthMonitoring'));

// Auth routes - lazy load with retry except login
const Signup = lazyWithRetry(() => import('@/pages/auth/signup'));
const VerifyEmail = lazyWithRetry(() => import('@/pages/auth/VerifyEmail'));
const ForgotPassword = lazyWithRetry(() => import('@/pages/auth/forgot-password'));
const ResetPassword = lazyWithRetry(() => import('@/pages/auth/reset-password'));
const Onboarding = lazyWithRetry(() => import('@/pages/onboarding'));

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
const MeetingIntelligence = lazyWithRetry(() => import('@/pages/MeetingIntelligence'));
const MeetingSentimentAnalytics = lazyWithRetry(() => import('@/pages/MeetingSentimentAnalytics'));
const FreepikFlow = lazyWithRetry(() => import('@/components/workflows/FreepikFlow'));
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
const Workflows = lazyWithRetry(() => import('@/pages/Workflows'));
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
const AISettings = lazyWithRetry(() => import('@/pages/settings/AISettings'));
const ExtractionRules = lazyWithRetry(() => import('@/pages/settings/ExtractionRules'));
const TeamSettings = lazyWithRetry(() => import('@/pages/settings/TeamSettings'));
const TeamAnalytics = lazyWithRetry(() => import('@/pages/insights/TeamAnalytics'));
const ContentTopics = lazyWithRetry(() => import('@/pages/insights/ContentTopics'));
const AdminModelSettings = lazyWithRetry(() => import('@/pages/admin/AdminModelSettings'));
const AdminPromptSettings = lazyWithRetry(() => import('@/pages/admin/PromptSettings'));
const LeadsInbox = lazyWithRetry(() => import('@/pages/leads/LeadsInbox'));
const SaasAdminDashboard = lazyWithRetry(() => import('@/pages/SaasAdminDashboard'));
const InternalDomainsSettings = lazyWithRetry(() => import('@/pages/admin/InternalDomainsSettings'));
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
      gcTime: 10 * 60 * 1000, // 10 minutes - keep cached data longer (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Prevent refetch on window focus
      refetchOnReconnect: true, // Only refetch on reconnect
      refetchOnMount: false, // Don't refetch if data is fresh
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
          <OrgProvider>
            <UserPermissionsProvider>
              <ViewModeProvider>
                <CopilotProvider>
                  <StateProvider>
                    <AppContent performanceMetrics={performanceMetrics} measurePerformance={measurePerformance} />
                  </StateProvider>
                </CopilotProvider>
              </ViewModeProvider>
            </UserPermissionsProvider>
          </OrgProvider>
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

        {/* Public proposal sharing - allows prospects to view shared proposals */}
        <Route path="/share/:token" element={<PublicProposal />} />

        {/* Public landing page for Meetings feature */}
        <Route path="/product/meetings/opus-v2" element={<MeetingsLanding />} />
        {/* Legacy redirect */}
        <Route path="/features/meetings" element={<Navigate to="/product/meetings/opus-v2" replace />} />

        {/* Auth routes that should also be accessible without protection */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* Organization invitation acceptance (can be accessed logged in or out) */}
        <Route path="/invite/:token" element={<AcceptInvitation />} />

        {/* All other routes wrapped in ProtectedRoute */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/debug-auth" element={<DebugAuth />} />
                {/* Home route - shows MeetingSentimentAnalytics (works for both internal and external) */}
                <Route path="/" element={<AppLayout><MeetingSentimentAnalytics /></AppLayout>} />
                {/* Original CRM Dashboard - Internal users only */}
                <Route path="/dashboard" element={<InternalRouteGuard><AppLayout><Dashboard /></AppLayout></InternalRouteGuard>} />
                {/* Internal-only routes - CRM and tools */}
                <Route path="/copilot" element={<InternalRouteGuard><AppLayout><Copilot /></AppLayout></InternalRouteGuard>} />
                <Route path="/activity" element={<InternalRouteGuard><AppLayout><ActivityLog /></AppLayout></InternalRouteGuard>} />
                <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                <Route path="/crm" element={<InternalRouteGuard><AppLayout><ElegantCRM /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/elegant" element={<Navigate to="/crm" replace />} />
                {/* Admin Dashboard and Sections - Admin only */}
                <Route path="/admin" element={<AdminRouteGuard><AppLayout><AdminDashboard /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/users" element={<AdminRouteGuard><AppLayout><Users /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/pipeline" element={<AdminRouteGuard><AppLayout><PipelineSettings /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/audit" element={<AdminRouteGuard><AppLayout><AuditLogs /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/smart-tasks" element={<AdminRouteGuard><AppLayout><SmartTasksAdmin /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/pipeline-automation" element={<AdminRouteGuard><AppLayout><PipelineAutomationAdmin /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/ai-settings" element={<AdminRouteGuard><AppLayout><AIProviderSettings /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/model-settings" element={<AdminRouteGuard><AppLayout><AdminModelSettings /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/prompts" element={<AdminRouteGuard><AppLayout><AdminPromptSettings /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/api-testing" element={<AdminRouteGuard><AppLayout><ApiTesting /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/function-testing" element={<AdminRouteGuard><AppLayout><FunctionTesting /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/workflows-test" element={<AdminRouteGuard><AppLayout><WorkflowsTestSuite /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/workflows-e2e" element={<AdminRouteGuard><AppLayout><WorkflowsE2ETestSuite /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/google-integration" element={<AdminRouteGuard><AppLayout><GoogleIntegrationTests /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/savvycal-settings" element={<AdminRouteGuard><AppLayout><SettingsSavvyCal /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/booking-sources" element={<AdminRouteGuard><AppLayout><SettingsBookingSources /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/system-health" element={<AdminRouteGuard><AppLayout><SystemHealth /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/database" element={<AdminRouteGuard><AppLayout><Database /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/reports" element={<AdminRouteGuard><AppLayout><Reports /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/documentation" element={<AdminRouteGuard><AppLayout><Documentation /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/health-rules" element={<AdminRouteGuard><AppLayout><HealthRules /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/branding" element={<AdminRouteGuard><AppLayout><LogoSettings /></AppLayout></AdminRouteGuard>} />
                <Route path="/admin/old" element={<AdminRouteGuard><AppLayout><Admin /></AppLayout></AdminRouteGuard>} /> {/* Keep old admin for reference */}
                {/* SaaS Admin Dashboard - Manage external customers, subscriptions, and feature flags */}
                <Route path="/saas-admin" element={<AdminRouteGuard><AppLayout><SaasAdminDashboard /></AppLayout></AdminRouteGuard>} />
                {/* Internal Domains Settings - Configure which email domains are internal */}
                <Route path="/admin/internal-domains" element={<AdminRouteGuard><AppLayout><InternalDomainsSettings /></AppLayout></AdminRouteGuard>} />
                {/* Internal-only tools */}
                <Route path="/workflows" element={<InternalRouteGuard><AppLayout><Workflows /></AppLayout></InternalRouteGuard>} />
                <Route path="/integrations" element={<InternalRouteGuard><AppLayout><Integrations /></AppLayout></InternalRouteGuard>} />
                <Route path="/email" element={<InternalRouteGuard><AppLayout><Email /></AppLayout></InternalRouteGuard>} />
                <Route path="/auth/google/callback" element={<GoogleCallback />} />
                <Route path="/oauth/fathom/callback" element={<FathomCallback />} />
                {/* Internal-only: Pipeline, Tasks, Calendar */}
                <Route path="/pipeline" element={<InternalRouteGuard><AppLayout><PipelinePage /></AppLayout></InternalRouteGuard>} />
                <Route path="/tasks" element={<InternalRouteGuard><AppLayout><TasksPage /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/tasks" element={<InternalRouteGuard><AppLayout><TasksPage /></AppLayout></InternalRouteGuard>} />
                <Route path="/tasks/settings" element={<InternalRouteGuard><AppLayout><GoogleTasksSettings /></AppLayout></InternalRouteGuard>} />
                <Route path="/calendar" element={<InternalRouteGuard><AppLayout><Calendar /></AppLayout></InternalRouteGuard>} />
                <Route path="/events" element={<InternalRouteGuard><AppLayout><Events /></AppLayout></InternalRouteGuard>} />
                <Route path="/leads" element={<InternalRouteGuard><AppLayout><LeadsInbox /></AppLayout></InternalRouteGuard>} />
                
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
                
                {/* Individual record routes - Internal only */}
                <Route path="/companies/:companyId" element={<InternalRouteGuard><AppLayout><CompanyProfile /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/companies/:companyId" element={<InternalRouteGuard><AppLayout><CompanyProfile /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/contacts/:id" element={<InternalRouteGuard><AppLayout><ContactRecord /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/deals/:id" element={<InternalRouteGuard><AppLayout><DealRecord /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/health" element={<InternalRouteGuard><AppLayout><HealthMonitoring /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/relationship-health" element={<Navigate to="/crm/health?tab=relationships" replace />} />

                {/* Other internal-only routes */}
                <Route path="/payments" element={<Navigate to="/clients" replace />} />
                <Route path="/clients" element={<InternalRouteGuard><AppLayout><Clients /></AppLayout></InternalRouteGuard>} />
                <Route path="/subscriptions" element={<Navigate to="/clients" replace />} />
                <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
                <Route path="/preferences" element={<Navigate to="/settings" replace />} />
                <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
                <Route path="/settings/team" element={<AppLayout><TeamSettings /></AppLayout>} />
                <Route path="/settings/ai" element={<AppLayout><AISettings /></AppLayout>} />
                <Route path="/settings/extraction-rules" element={<AppLayout><ExtractionRules /></AppLayout>} />
                <Route path="/insights/team" element={<AppLayout><TeamAnalytics /></AppLayout>} />
                <Route path="/insights/content-topics" element={<AppLayout><ContentTopics /></AppLayout>} />
                <Route path="/roadmap" element={<AppLayout><Roadmap /></AppLayout>} />
                <Route path="/roadmap/ticket/:ticketId" element={<AppLayout><Roadmap /></AppLayout>} />
                <Route path="/releases" element={<AppLayout><Releases /></AppLayout>} />
                <Route path="/meetings" element={<AppLayout><MeetingsPage /></AppLayout>} />
                <Route path="/meetings/intelligence" element={<AppLayout><MeetingIntelligence /></AppLayout>} />
                <Route path="/meetings/sentiment" element={<AppLayout><MeetingSentimentAnalytics /></AppLayout>} />
                <Route path="/meetings/:id" element={<AppLayout><MeetingDetail /></AppLayout>} />
                <Route path="/debug-meetings" element={<AppLayout><DebugMeetings /></AppLayout>} />
                <Route path="/test-notifications" element={<AppLayout><TestNotifications /></AppLayout>} />
                <Route path="/freepik-flow" element={<AppLayout><div className="h-[calc(100vh-4rem)]"><FreepikFlow /></div></AppLayout>} />
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