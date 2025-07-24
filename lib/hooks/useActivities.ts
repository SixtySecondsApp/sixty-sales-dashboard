import { create } from 'zustand';
import { format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { IdentifierType } from '../../components/IdentifierField';

const generateDummyData = async () => {
  const activities = [];
  const companies = [
    'Tech Solutions', 'Global Systems', 'Innovate Inc', 'Digital Dynamics',
    'Future Corp', 'Smart Solutions', 'Cloud Nine', 'Peak Performance',
    'Elite Enterprises', 'Quantum Corp'
  ];
  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single();
  const salesRep = profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown';
  const activityTypes = ['sale', 'outbound', 'meeting', 'proposal'];
  const priorities = ['high', 'medium', 'low'];
  const meetingTypes = ['Discovery Call', 'Demo', 'Follow-up', 'Proposal'];
  const contactMethods = ['Phone', 'Email', 'LinkedIn'];

  // Generate activities for December 2024
  for (let i = 0; i < 25; i++) {
    const date = new Date(2024, 11, Math.floor(Math.random() * 31) + 1);
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    
    activities.push({
      id: `dec-${i}-${Math.random()}`,
      type,
      clientName: type === 'outbound' ? undefined : companies[Math.floor(Math.random() * companies.length)],
      date: format(date, 'yyyy-MM-dd'),
      salesRep,
      amount: type === 'sale' ? Math.floor(Math.random() * 50000) + 5000 : 
              type === 'proposal' ? Math.floor(Math.random() * 75000) + 10000 : undefined,
      status: 'completed',
      details: type === 'meeting' ? meetingTypes[Math.floor(Math.random() * meetingTypes.length)] :
               type === 'outbound' ? contactMethods[Math.floor(Math.random() * contactMethods.length)] :
               type === 'proposal' ? `Proposal Value: £${Math.floor(Math.random() * 75000) + 10000}` :
               'Signed',
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      quantity: type === 'outbound' ? Math.floor(Math.random() * 30) + 10 : 1  // 10-40 for outbound, 1 for others
    });
  }

  // Generate activities for January 2025 (up to 12th)
  for (let i = 0; i < 25; i++) {
    const date = new Date(2025, 0, Math.floor(Math.random() * 12) + 1);
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    
    activities.push({
      id: `jan-${i}-${Math.random()}`,
      type,
      clientName: type === 'outbound' ? undefined : companies[Math.floor(Math.random() * companies.length)],
      date: format(date, 'yyyy-MM-dd'),
      salesRep,
      amount: type === 'sale' ? Math.floor(Math.random() * 50000) + 5000 : 
              type === 'proposal' ? Math.floor(Math.random() * 75000) + 10000 : undefined,
      status: 'completed',
      details: type === 'meeting' ? meetingTypes[Math.floor(Math.random() * meetingTypes.length)] :
               type === 'outbound' ? contactMethods[Math.floor(Math.random() * contactMethods.length)] :
               type === 'proposal' ? `Proposal Value: £${Math.floor(Math.random() * 75000) + 10000}` :
               'Signed',
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      quantity: type === 'outbound' ? Math.floor(Math.random() * 30) + 10 : 1  // 10-40 for outbound, 1 for others
    });
  }

  return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export interface Activity {
  id: string;
  type: 'sale' | 'outbound' | 'meeting' | 'proposal';
  clientName?: string;
  date: string;
  amount?: number;
  quantity: number;
  salesRep: string;
  status: 'completed' | 'pending' | 'cancelled' | 'no_show';
  details: string;
  priority: 'high' | 'medium' | 'low';
  contactIdentifier?: string;
  contactIdentifierType?: IdentifierType;
}

interface ActivitiesStore {
  activities: Activity[];
  addActivity: (activity: {
    type: Activity['type'];
    details: string;
    priority: Activity['priority'];
    amount?: number;
    clientName?: string;
    salesRep: string;
  }) => void;
  removeActivity: (id: string) => void;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
}

export const useActivities = create<ActivitiesStore>((set) => ({
  activities: generateDummyData(),
  addActivity: (activity) => 
    set((state) => ({
      activities: [
        {
          ...activity,
          id: Math.random().toString(36).substr(2, 9),
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'completed',
          quantity: activity.type === 'outbound' ? 20 : 1,
          clientName: activity.type === 'outbound' ? 'Outbound Activity' : activity.clientName || 'Unknown'
        },
        ...state.activities
      ]
    })),
  removeActivity: (id) =>
    set((state) => ({
      activities: state.activities.filter((activity) => activity.id !== id)
    })),
  updateActivity: (id, updates) =>
    set((state) => ({
      activities: state.activities.map((activity) =>
        activity.id === id ? { ...activity, ...updates } : activity
      )
    }))
}));