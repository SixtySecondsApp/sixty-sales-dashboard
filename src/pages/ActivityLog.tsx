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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Activity Management</h1>
              <p className="text-sm text-gray-400 mt-1">
                Track activities and process raw data
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50">
              <TabsTrigger 
                value="log" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <FileText className="w-4 h-4" />
                Activity Log
              </TabsTrigger>
              <TabsTrigger 
                value="processing" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
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