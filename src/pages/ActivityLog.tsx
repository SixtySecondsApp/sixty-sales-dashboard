import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesTable } from '@/components/SalesTable';
import { ActivityProcessingPage } from '@/pages/ActivityProcessingPage';
import { useActivityFilters } from '@/lib/hooks/useActivityFilters';
import { FileText, MailWarning } from 'lucide-react';

export default function ActivityLog() {
  const { resetFilters } = useActivityFilters();
  const location = useLocation();
  const isFromDashboard = useRef(false);
  const [activeTab, setActiveTab] = useState('log');
  
  // Check if navigation came from dashboard (has state)
  useEffect(() => {
    // If location.state exists, we're coming from a dashboard card click
    // Otherwise, we're navigating directly to the Activity page
    if (!location.state || !location.state.preserveFilters) {
      if (!isFromDashboard.current) {
        resetFilters();
      }
    } else {
      isFromDashboard.current = true;
    }
    
    // Reset the ref when leaving the page
    return () => {
      isFromDashboard.current = false;
    };
  }, [location, resetFilters]);
  
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Management</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Track activities and process raw data
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white border border-transparent shadow-sm dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50">
              <TabsTrigger
                value="log"
                className="flex items-center gap-2 data-[state=active]:bg-emerald-600/10 dark:data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400"
              >
                <FileText className="w-4 h-4" />
                Activity Log
              </TabsTrigger>
              <TabsTrigger
                value="processing"
                className="flex items-center gap-2 data-[state=active]:bg-emerald-600/10 dark:data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400"
              >
                <MailWarning className="w-4 h-4" />
                Activity Processing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="log" className="space-y-0">
              <SalesTable />
            </TabsContent>

            <TabsContent value="processing" className="space-y-0">
              <ActivityProcessingPage />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}