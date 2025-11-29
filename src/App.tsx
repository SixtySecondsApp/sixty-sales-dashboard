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
import { InternalRouteGuard, OrgAdminRouteGuard, PlatformAdminRouteGuard } from '@/components/RouteGuard';
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
import MeetingsLandingV2 from '@/product-pages/meetings/MeetingsLandingV2';
import MeetingsLandingV3 from '@/product-pages/meetings/MeetingsLandingV3';
import { MeetingsLandingV4 } from '@/product-pages/meetings/MeetingsLandingV4';

// Heavy routes - lazy load with retry mechanism to handle cache issues
const ActivityLog = lazyWithRetry(() => import('@/pages/ActivityLog'));
const Heatmap = lazyWithRetry(() => import('@/pages/Heatmap'));
const SalesFunnel = lazyWithRetry(() => import('@/pages/SalesFunnel'));
const Profile = lazyWithRetry(() => import('@/pages/Profile'));
// Calendar page removed - users now redirected to Google Calendar directly

// Admin routes - lazy load with retry (infrequently accessed, more prone to cache issues)
const Users = lazyWithRetry(() => import('@/pages/admin/Users'));
const PipelineSettings = lazyWithRetry(() => import('@/pages/admin/PipelineSettings'));
const AuditLogs = lazyWithRetry(() => import('@/pages/admin/AuditLogs'));
const SmartTasksAdmin = lazyWithRetry(() => import('@/pages/SmartTasksAdmin'));
const PipelineAutomationAdmin = lazyWithRetry(() => import('@/pages/PipelineAutomationAdmin'));
// ApiTesting already imported below
const FunctionTesting = lazyWithRetry(() => import('@/pages/admin/FunctionTesting'));
// WorkflowsTestSuite and WorkflowsE2ETestSuite - REMOVED (specialized test pages, keeping only API + Function testing)
const AIProviderSettings = lazyWithRetry(() => import('@/components/settings/AIProviderSettings'));
const GoogleIntegrationTests = lazyWithRetry(() => import('@/components/admin/GoogleIntegrationTests').then(m => ({ default: m.GoogleIntegrationTests })));
const SettingsSavvyCal = lazyWithRetry(() => import('@/pages/admin/SettingsSavvyCal'));
const SettingsBookingSources = lazyWithRetry(() => import('@/pages/admin/SettingsBookingSources'));
// SystemHealth, Database, Reports, Documentation - REMOVED (scaffolded only, not functional)
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
// Admin pages removed - now using /platform routes instead
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
// Email page removed - users now redirected to Gmail directly
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

// New 3-tier architecture routes
const PlatformDashboard = lazyWithRetry(() => import('@/pages/platform/PlatformDashboard'));
const OrgDashboard = lazyWithRetry(() => import('@/pages/org/OrgDashboard'));
const TeamManagement = lazyWithRetry(() => import('@/pages/org/TeamManagement'));
const OrgBranding = lazyWithRetry(() => import('@/pages/org/OrgBranding'));
const OrgBilling = lazyWithRetry(() => import('@/pages/OrgBilling'));

// Note: CompaniesPage and ContactsPage removed - routes now redirect to CRM

// Loading component for better UX during code splitting
const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
  </div>
);

// External redirect component for Google services
const ExternalRedirect: React.FC<{ url: string }> = ({ url }) => {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      <p className="text-gray-500">Redirecting to Google...</p>
    </div>
  );
};

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
        <Route path="/product/meetings" element={<MeetingsLandingV4 />} />
        <Route path="/product/meetings-v1" element={<MeetingsLanding />} />
        <Route path="/product/meetings-v2" element={<MeetingsLandingV2 />} />
        <Route path="/product/meetings-v3" element={<MeetingsLandingV3 />} />
        <Route path="/product/meetings-v4" element={<Navigate to="/product/meetings" replace />} />
        <Route path="/features/meetings-v3" element={<Navigate to="/product/meetings-v3" replace />} />
        <Route path="/features/meetings-v4" element={<Navigate to="/product/meetings" replace />} />
        {/* Legacy redirects */}
        <Route path="/product/meetings/opus-v2" element={<Navigate to="/product/meetings-v1" replace />} />
        <Route path="/features/meetings" element={<Navigate to="/product/meetings" replace />} />
        <Route path="/features/meetings-v1" element={<Navigate to="/product/meetings-v1" replace />} />
        <Route path="/features/meetings-v2" element={<Navigate to="/product/meetings-v2" replace />} />

        {/* Public pricing page - redirected to landing page */}
        <Route path="/product/meetings/pricing" element={<Navigate to="/product/meetings" replace />} />
        {/* Legacy pricing redirect */}
        <Route path="/pricing" element={<Navigate to="/product/meetings/pricing" replace />} />

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
                {/* Home route - shows Activity Dashboard for internal users, Meeting Analytics for external */}
                <Route path="/" element={<InternalRouteGuard><AppLayout><Dashboard /></AppLayout></InternalRouteGuard>} />
                {/* Dashboard alias for backwards compatibility */}
                <Route path="/dashboard" element={<InternalRouteGuard><AppLayout><Dashboard /></AppLayout></InternalRouteGuard>} />
                {/* Internal-only routes - CRM and tools */}
                <Route path="/copilot" element={<InternalRouteGuard><AppLayout><Copilot /></AppLayout></InternalRouteGuard>} />
                <Route path="/activity" element={<InternalRouteGuard><AppLayout><ActivityLog /></AppLayout></InternalRouteGuard>} />
                <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                <Route path="/crm" element={<InternalRouteGuard><AppLayout><ElegantCRM /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/elegant" element={<Navigate to="/crm" replace />} />
                {/* Legacy /admin routes - redirect to /platform (replaced by 3-tier architecture) */}
                <Route path="/admin" element={<Navigate to="/platform" replace />} />
                <Route path="/admin/users" element={<Navigate to="/platform/users" replace />} />
                <Route path="/admin/pipeline" element={<Navigate to="/platform/crm/pipeline" replace />} />
                <Route path="/admin/audit" element={<Navigate to="/platform/audit" replace />} />
                <Route path="/admin/smart-tasks" element={<Navigate to="/platform/crm/smart-tasks" replace />} />
                <Route path="/admin/pipeline-automation" element={<Navigate to="/platform/crm/automation" replace />} />
                <Route path="/admin/ai-settings" element={<Navigate to="/platform/ai/settings" replace />} />
                <Route path="/admin/model-settings" element={<Navigate to="/platform/ai/settings" replace />} />
                <Route path="/admin/prompts" element={<Navigate to="/platform/ai/prompts" replace />} />
                <Route path="/admin/api-testing" element={<Navigate to="/platform/dev/api-testing" replace />} />
                <Route path="/admin/function-testing" element={<Navigate to="/platform/dev/function-testing" replace />} />
                <Route path="/admin/google-integration" element={<Navigate to="/platform/integrations/google" replace />} />
                <Route path="/admin/savvycal-settings" element={<Navigate to="/platform/integrations/savvycal" replace />} />
                <Route path="/admin/booking-sources" element={<Navigate to="/platform/integrations/booking-sources" replace />} />
                <Route path="/admin/health-rules" element={<Navigate to="/platform/crm/health-rules" replace />} />
                <Route path="/admin/branding" element={<Navigate to="/org/branding" replace />} />
                <Route path="/admin/internal-domains" element={<Navigate to="/platform/integrations/domains" replace />} />
                <Route path="/admin/*" element={<Navigate to="/platform" replace />} /> {/* Catch-all for any remaining /admin routes */}

                {/* ========================================= */}
                {/* NEW 3-TIER ARCHITECTURE ROUTES           */}
                {/* ========================================= */}

                {/* Tier 2: Organization Admin Routes (Org owners/admins + Platform admins) */}
                <Route path="/org" element={<OrgAdminRouteGuard><AppLayout><OrgDashboard /></AppLayout></OrgAdminRouteGuard>} />
                <Route path="/org/team" element={<OrgAdminRouteGuard><AppLayout><TeamManagement /></AppLayout></OrgAdminRouteGuard>} />
                <Route path="/org/branding" element={<OrgAdminRouteGuard><AppLayout><OrgBranding /></AppLayout></OrgAdminRouteGuard>} />
                <Route path="/org/billing" element={<OrgAdminRouteGuard><AppLayout><OrgBilling /></AppLayout></OrgAdminRouteGuard>} />
                <Route path="/org/billing/success" element={<OrgAdminRouteGuard><AppLayout><OrgBilling /></AppLayout></OrgAdminRouteGuard>} />
                <Route path="/org/billing/cancel" element={<OrgAdminRouteGuard><AppLayout><OrgBilling /></AppLayout></OrgAdminRouteGuard>} />

                {/* Tier 3: Platform Admin Routes (Internal + is_admin only) */}
                <Route path="/platform" element={<PlatformAdminRouteGuard><AppLayout><PlatformDashboard /></AppLayout></PlatformAdminRouteGuard>} />
                {/* Platform Admin - Customer Management */}
                <Route path="/platform/customers" element={<PlatformAdminRouteGuard><AppLayout><SaasAdminDashboard /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/plans" element={<PlatformAdminRouteGuard><AppLayout><SaasAdminDashboard /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/users" element={<PlatformAdminRouteGuard><AppLayout><Users /></AppLayout></PlatformAdminRouteGuard>} />
                {/* Platform Admin - CRM Configuration */}
                <Route path="/platform/crm/pipeline" element={<PlatformAdminRouteGuard><AppLayout><PipelineSettings /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/crm/smart-tasks" element={<PlatformAdminRouteGuard><AppLayout><SmartTasksAdmin /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/crm/automation" element={<PlatformAdminRouteGuard><AppLayout><PipelineAutomationAdmin /></AppLayout></PlatformAdminRouteGuard>} />
                {/* Platform Admin - AI Configuration */}
                <Route path="/platform/ai/settings" element={<PlatformAdminRouteGuard><AppLayout><AIProviderSettings /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/ai/prompts" element={<PlatformAdminRouteGuard><AppLayout><AdminPromptSettings /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/features" element={<PlatformAdminRouteGuard><AppLayout><SaasAdminDashboard /></AppLayout></PlatformAdminRouteGuard>} />
                {/* Platform Admin - Integrations */}
                <Route path="/platform/integrations/google" element={<PlatformAdminRouteGuard><AppLayout><GoogleIntegrationTests /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/integrations/savvycal" element={<PlatformAdminRouteGuard><AppLayout><SettingsSavvyCal /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/integrations/booking-sources" element={<PlatformAdminRouteGuard><AppLayout><SettingsBookingSources /></AppLayout></PlatformAdminRouteGuard>} />
                {/* Platform Admin - Security & Audit */}
                <Route path="/platform/audit" element={<PlatformAdminRouteGuard><AppLayout><AuditLogs /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/usage" element={<PlatformAdminRouteGuard><AppLayout><SaasAdminDashboard /></AppLayout></PlatformAdminRouteGuard>} />
                {/* Platform Admin - Development Tools (API + Function testing only) */}
                <Route path="/platform/dev/api-testing" element={<PlatformAdminRouteGuard><AppLayout><ApiTesting /></AppLayout></PlatformAdminRouteGuard>} />
                <Route path="/platform/dev/function-testing" element={<PlatformAdminRouteGuard><AppLayout><FunctionTesting /></AppLayout></PlatformAdminRouteGuard>} />

                {/* Internal-only tools */}
                <Route path="/workflows" element={<InternalRouteGuard><AppLayout><Workflows /></AppLayout></InternalRouteGuard>} />
                <Route path="/integrations" element={<InternalRouteGuard><AppLayout><Integrations /></AppLayout></InternalRouteGuard>} />
                {/* Email and Calendar routes redirect to Google services */}
                <Route path="/email" element={<ExternalRedirect url="https://mail.google.com" />} />
                <Route path="/auth/google/callback" element={<GoogleCallback />} />
                <Route path="/oauth/fathom/callback" element={<FathomCallback />} />
                {/* Internal-only: Pipeline, Tasks */}
                <Route path="/pipeline" element={<InternalRouteGuard><AppLayout><PipelinePage /></AppLayout></InternalRouteGuard>} />
                <Route path="/tasks" element={<InternalRouteGuard><AppLayout><TasksPage /></AppLayout></InternalRouteGuard>} />
                <Route path="/crm/tasks" element={<InternalRouteGuard><AppLayout><TasksPage /></AppLayout></InternalRouteGuard>} />
                <Route path="/tasks/settings" element={<InternalRouteGuard><AppLayout><GoogleTasksSettings /></AppLayout></InternalRouteGuard>} />
                <Route path="/calendar" element={<ExternalRedirect url="https://calendar.google.com" />} />
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
                <Route path="/api-testing" element={<Navigate to="/platform/dev/api-testing" replace />} />
                <Route path="/crm/companies" element={<Navigate to="/crm" replace />} />
                <Route path="/crm/contacts" element={<Navigate to="/crm?tab=contacts" replace />} />

                {/* Legacy redirects for 3-tier migration (keep for 3-6 months) */}
                <Route path="/saas-admin" element={<Navigate to="/platform" replace />} />
                <Route path="/settings/team" element={<Navigate to="/org/team" replace />} />
                
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