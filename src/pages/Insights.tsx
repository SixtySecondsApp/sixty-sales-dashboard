import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SalesFunnel from '@/pages/SalesFunnel';
import Heatmap from '@/pages/Heatmap';
import { LineChart, Activity, Sparkles } from 'lucide-react';
import { LeadAnalyticsCard } from '@/components/leads/LeadAnalyticsCard';

export default function Insights() {
  const [activeTab, setActiveTab] = useState('funnel');
  
  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Insights</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Analyze your sales performance and activity patterns
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white border border-transparent shadow-sm dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50">
              <TabsTrigger
                value="funnel"
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <LineChart className="w-4 h-4" />
                Sales Funnel
              </TabsTrigger>
              <TabsTrigger
                value="heatmap"
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <Activity className="w-4 h-4" />
                Activity Heatmap
              </TabsTrigger>
              <TabsTrigger
                value="leads"
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <Sparkles className="w-4 h-4" />
                Lead Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="funnel" className="space-y-0">
              <SalesFunnel />
            </TabsContent>

            <TabsContent value="heatmap" className="space-y-0">
              <Heatmap />
            </TabsContent>

            <TabsContent value="leads" className="space-y-0">
              <LeadAnalyticsCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
