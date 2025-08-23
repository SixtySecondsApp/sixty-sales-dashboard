import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { createApiMonitor } from '@/lib/utils/apiUtils';
import { API_BASE_URL } from '@/lib/config';
import PerformanceMonitor from '@/lib/utils/performanceMonitor';
import { AppLayout } from '@/components/AppLayout';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { useInitializeAuditSession } from '@/lib/hooks/useAuditSession';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePerformanceOptimization } from '@/lib/hooks/usePerformanceOptimization';
import { IntelligentPreloader } from '@/components/LazyComponents';
import { webVitalsOptimizer } from '@/lib/utils/webVitals';
import { removeSignedAndPaidStage } from '@/lib/utils/migrateStages';

// Use regular dashboard - optimization had issues
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/auth/login';
import logger from '@/lib/utils/logger';

// Heavy routes - lazy load to reduce initial bundle size
const ActivityLog = lazy(() => import('@/pages/ActivityLog'));
const Heatmap = lazy(() => import('@/pages/Heatmap'));
const SalesFunnel = lazy(() => import('@/pages/SalesFunnel'));
const Profile = lazy(() => import('@/pages/Profile'));

// Admin routes - lazy load (infrequently accessed)
const Users = lazy(() => import('@/pages/admin/Users'));
const PipelineSettings = lazy(() => import('@/pages/admin/PipelineSettings'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));

// Auth routes - lazy load except login
const Signup = lazy(() => import('@/pages/auth/signup'));
const ForgotPassword = lazy(() => import('@/pages/auth/forgot-password'));
const ResetPassword = lazy(() => import('@/pages/auth/reset-password'));

// Large feature routes - lazy load
const PipelinePage = lazy(() => import('@/pages/PipelinePage').then(module => ({ default: module.PipelinePage })));
const ActivityProcessingPage = lazy(() => import('@/pages/ActivityProcessingPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const Roadmap = lazy(() => import('@/pages/Roadmap'));
const Clients = lazy(() => import('@/pages/Clients'));
const TestFallback = lazy(() => import('@/pages/TestFallback'));

// CRM routes - heavy components, lazy load
const CompaniesTable = lazy(() => import('@/pages/companies/CompaniesTable'));
const CompanyProfile = lazy(() => import('@/pages/companies/CompanyProfile'));
const ContactsTable = lazy(() => import('@/pages/contacts/ContactsTable'));
const ContactRecord = lazy(() => import('@/pages/contacts/ContactRecord'));
const DealRecord = lazy(() => import('@/pages/deals/DealRecord'));

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

  // Run database migrations on app start
  useEffect(() => {
    const runMigrations = async () => {
      try {
        await removeSignedAndPaidStage();
        logger.log('✅ Database migrations completed successfully');
      } catch (error) {
        logger.error('❌ Database migration failed:', error);
      }
    };
    
    runMigrations();
  }, []); // Run only once on app start

  // Initialize performance monitoring
  useEffect(() => {
    const performanceMonitor = PerformanceMonitor.getInstance();
    
    // Enable performance monitoring in production for real user monitoring
    performanceMonitor.setEnabled(true);
    
    // Initialize Web Vitals optimization
    webVitalsOptimizer.initializeMonitoring(process.env.NODE_ENV === 'production');
    
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IntelligentPreloader />
        <ProtectedRoute>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/signup" element={<Signup />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/activity" element={<AppLayout><ActivityLog /></AppLayout>} />
              <Route path="/heatmap" element={<AppLayout><Heatmap /></AppLayout>} />
              <Route path="/funnel" element={<AppLayout><SalesFunnel /></AppLayout>} />
              <Route path="/pipeline" element={<AppLayout><PipelinePage /></AppLayout>} />
              <Route path="/tasks" element={<AppLayout><TasksPage /></AppLayout>} />
              <Route path="/companies" element={<AppLayout><CompaniesTable /></AppLayout>} />
              <Route path="/companies/:companyId" element={<AppLayout><CompanyProfile /></AppLayout>} />
              <Route path="/crm/companies" element={<AppLayout><CompaniesTable /></AppLayout>} />
              <Route path="/crm/companies/:companyId" element={<AppLayout><CompanyProfile /></AppLayout>} />
              <Route path="/crm/contacts" element={<AppLayout><ContactsTable /></AppLayout>} />
              <Route path="/crm/contacts/:id" element={<AppLayout><ContactRecord /></AppLayout>} />
              <Route path="/crm/deals/:id" element={<AppLayout><DealRecord /></AppLayout>} />
              <Route path="/payments" element={<Navigate to="/clients" replace />} />
              <Route path="/clients" element={<AppLayout><Clients /></AppLayout>} />
              <Route path="/subscriptions" element={<Navigate to="/clients" replace />} />
              <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
              <Route path="/activity-processing" element={<AppLayout><ActivityProcessingPage /></AppLayout>} />
              <Route path="/roadmap" element={<AppLayout><Roadmap /></AppLayout>} />
              <Route path="/roadmap/ticket/:ticketId" element={<AppLayout><Roadmap /></AppLayout>} />
              <Route path="/admin/users" element={<AppLayout><Users /></AppLayout>} />
              <Route path="/admin/pipeline-settings" element={<AppLayout><PipelineSettings /></AppLayout>} />
              <Route path="/admin/audit-logs" element={<AppLayout><AuditLogs /></AppLayout>} />
              <Route path="/test-fallback" element={<ProtectedRoute><TestFallback /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </ProtectedRoute>
        <Toaster />
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] pointer-events-none" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;