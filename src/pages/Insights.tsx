import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SalesFunnel from '@/pages/SalesFunnel';
import Heatmap from '@/pages/Heatmap';
import { LineChart, Activity } from 'lucide-react';

export default function Insights() {
  const [activeTab, setActiveTab] = useState('funnel');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Sales Insights</h1>
              <p className="text-sm text-gray-400 mt-1">
                Analyze your sales performance and activity patterns
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50">
              <TabsTrigger 
                value="funnel" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <LineChart className="w-4 h-4" />
                Sales Funnel
              </TabsTrigger>
              <TabsTrigger 
                value="heatmap" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Activity className="w-4 h-4" />
                Activity Heatmap
              </TabsTrigger>
            </TabsList>

            <TabsContent value="funnel" className="space-y-0">
              <SalesFunnel />
            </TabsContent>

            <TabsContent value="heatmap" className="space-y-0">
              <Heatmap />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
