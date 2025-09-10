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

// Heavy routes - lazy load with retry mechanism to handle cache issues
const ActivityLog = lazyWithRetry(() => import('@/pages/ActivityLog'));
const Heatmap = lazyWithRetry(() => import('@/pages/Heatmap'));
const SalesFunnel = lazyWithRetry(() => import('@/pages/SalesFunnel'));
const Profile = lazyWithRetry(() => import('@/pages/Profile'));

// Admin routes - lazy load with retry (infrequently accessed, more prone to cache issues)
const Users = lazyWithRetry(() => import('@/pages/admin/Users'));
const PipelineSettings = lazyWithRetry(() => import('@/pages/admin/PipelineSettings'));
const AuditLogs = lazyWithRetry(() => import('@/pages/admin/AuditLogs'));
const SmartTasksAdmin = lazyWithRetry(() => import('@/pages/SmartTasksAdmin'));
const PipelineAutomationAdmin = lazyWithRetry(() => import('@/pages/PipelineAutomationAdmin'));

// Auth routes - lazy load with retry except login
const Signup = lazyWithRetry(() => import('@/pages/auth/signup'));
const ForgotPassword = lazyWithRetry(() => import('@/pages/auth/forgot-password'));
const ResetPassword = lazyWithRetry(() => import('@/pages/auth/reset-password'));

// Large feature routes - lazy load with retry (most prone to cache issues)
const PipelinePage = lazyWithRetry(() => import('@/pages/PipelinePage').then(module => ({ default: module.PipelinePage })));
const ActivityProcessingPage = lazyWithRetry(() => import('@/pages/ActivityProcessingPage'));
const TasksPage = lazyWithRetry(() => import('@/pages/TasksPage'));
const Roadmap = lazyWithRetry(() => import('@/pages/Roadmap'));
const Releases = lazyWithRetry(() => import('@/pages/Releases'));
const Clients = lazyWithRetry(() => import('@/pages/Clients'));
const TestFallback = lazyWithRetry(() => import('@/pages/TestFallback'));
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage'));
const DebugAuth = lazy(() => import('@/pages/DebugAuth'));
const DebugMeetings = lazy(() => import('@/pages/DebugMeetings'));
const ApiTesting = lazy(() => import('@/pages/ApiTesting'));
const TestNotifications = lazy(() => import('@/pages/TestNotifications'));

// CRM routes - heavy components, lazy load
const CRM = lazy(() => import('@/pages/CRM'));
const ElegantCRM = lazy(() => import('@/pages/ElegantCRM'));
const Admin = lazy(() => import('@/pages/Admin'));
const Insights = lazy(() => import('@/pages/Insights'));
const Workflows = lazy(() => import('@/pages/Workflows'));
const Integrations = lazy(() => import('@/pages/Integrations'));
const FormDisplay = lazy(() => import('@/pages/FormDisplay'));
const CompaniesTable = lazy(() => import('@/pages/companies/CompaniesTable'));
const CompanyProfile = lazy(() => import('@/pages/companies/CompanyProfile'));
const ContactsTable = lazy(() => import('@/pages/contacts/ContactsTable'));
const ContactRecord = lazy(() => import('@/pages/contacts/ContactRecord'));
const DealRecord = lazy(() => import('@/pages/deals/DealRecord'));

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

// Make queryClient globally available
declare global {
  interface Window {
    queryClient: QueryClient;
  }
}
window.queryClient = queryClient;

function App() {
  // Initialize audit session tracking
  useInitializeAuditSession();
  
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
            <StateProvider>
            <IntelligentPreloader />
            <ProtectedRoute>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />
                <Route path="/debug-auth" element={<DebugAuth />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
                <Route path="/activity" element={<AppLayout><ActivityLog /></AppLayout>} />
                <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                <Route path="/crm" element={<AppLayout><ElegantCRM /></AppLayout>} />
                <Route path="/crm/elegant" element={<Navigate to="/crm" replace />} />
                <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
                <Route path="/workflows" element={<AppLayout><Workflows /></AppLayout>} />
                <Route path="/integrations" element={<AppLayout><Integrations /></AppLayout>} />
                <Route path="/pipeline" element={<AppLayout><PipelinePage /></AppLayout>} />
                <Route path="/tasks" element={<AppLayout><TasksPage /></AppLayout>} />
                
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
                <Route path="/api-testing" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/users" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/pipeline-settings" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/audit-logs" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/smart-tasks" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/pipeline-automation" element={<Navigate to="/admin" replace />} />
                <Route path="/crm/companies" element={<Navigate to="/crm" replace />} />
                <Route path="/crm/contacts" element={<Navigate to="/crm?tab=contacts" replace />} />
                
                {/* Individual record routes */}
                <Route path="/companies/:companyId" element={<AppLayout><CompanyProfile /></AppLayout>} />
                <Route path="/crm/companies/:companyId" element={<AppLayout><CompanyProfile /></AppLayout>} />
                <Route path="/crm/contacts/:id" element={<AppLayout><ContactRecord /></AppLayout>} />
                <Route path="/crm/deals/:id" element={<AppLayout><DealRecord /></AppLayout>} />
                
                {/* Other routes */}
                <Route path="/payments" element={<Navigate to="/clients" replace />} />
                <Route path="/clients" element={<AppLayout><Clients /></AppLayout>} />
                <Route path="/subscriptions" element={<Navigate to="/clients" replace />} />
                <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
                <Route path="/roadmap" element={<AppLayout><Roadmap /></AppLayout>} />
                <Route path="/roadmap/ticket/:ticketId" element={<AppLayout><Roadmap /></AppLayout>} />
                <Route path="/releases" element={<AppLayout><Releases /></AppLayout>} />
                <Route path="/meetings/*" element={<AppLayout><MeetingsPage /></AppLayout>} />
                <Route path="/debug-meetings" element={<AppLayout><DebugMeetings /></AppLayout>} />
                <Route path="/test-notifications" element={<AppLayout><TestNotifications /></AppLayout>} />
                <Route path="/test-fallback" element={<ProtectedRoute><TestFallback /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </ProtectedRoute>
          <Toaster />
          <VersionManager />
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] pointer-events-none" />
            </StateProvider>
          </ViewModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;