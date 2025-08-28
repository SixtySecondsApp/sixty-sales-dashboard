import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompaniesTable from '@/pages/companies/CompaniesTable';
import ContactsTable from '@/pages/contacts/ContactsTable';
import { PipelinePage } from '@/pages/PipelinePage';
import MeetingsPage from '@/pages/MeetingsPage';
import { 
  Building2, 
  Users, 
  Heart, 
  Video 
} from 'lucide-react';

export default function CRM() {
  const [activeTab, setActiveTab] = useState('companies');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Customer Relationship Management</h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage your companies, contacts, deals, and meetings
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50">
              <TabsTrigger 
                value="companies" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Building2 className="w-4 h-4" />
                Companies
              </TabsTrigger>
              <TabsTrigger 
                value="contacts" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Users className="w-4 h-4" />
                Contacts
              </TabsTrigger>
              <TabsTrigger 
                value="deals" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Heart className="w-4 h-4" />
                Deals
              </TabsTrigger>
              <TabsTrigger 
                value="meetings" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Video className="w-4 h-4" />
                Meetings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="companies" className="space-y-0">
              <CompaniesTable />
            </TabsContent>

            <TabsContent value="contacts" className="space-y-0">
              <ContactsTable />
            </TabsContent>

            <TabsContent value="deals" className="space-y-0">
              <PipelinePage />
            </TabsContent>

            <TabsContent value="meetings" className="space-y-0">
              <MeetingsPage />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
