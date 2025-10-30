import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Heart, 
  Video,
  TrendingUp,
  Award,
  Clock,
  DollarSign,
  UserPlus,
  Calendar,
  Target,
  Percent,
  Phone
} from 'lucide-react';

interface ViewSpecificStatsProps {
  activeTab: string;
  companies?: any[];
  contacts?: any[];
  deals?: any[];
  meetings?: any[];
}

export function ViewSpecificStats({ activeTab, companies = [], contacts = [], deals = [], meetings = [] }: ViewSpecificStatsProps) {
  // Calculate companies stats
  const companiesStats = [
    { label: 'Total New Business', value: '$2.4M', change: '+15%', icon: DollarSign, color: 'emerald' },
    { label: 'Active Deals', value: deals.length.toString(), change: '+8', icon: Heart, color: 'blue' },
    { label: 'Companies', value: companies.length.toString(), change: '+12%', icon: Building2, color: 'violet' },
    { label: 'This Month', value: '28', change: '+5', icon: Calendar, color: 'orange' },
  ];

  // Calculate contacts stats  
  const contactsStats = [
    { label: 'Total Contacts', value: contacts.length.toString(), change: '+23%', icon: Users, color: 'emerald' },
    { label: 'New This Month', value: '42', change: '+15%', icon: UserPlus, color: 'blue' },
    { label: 'Engagement Rate', value: '68%', change: '+5%', icon: TrendingUp, color: 'violet' },
    { label: 'Follow-ups Due', value: '12', change: '+3', icon: Clock, color: 'orange' },
  ];

  // Calculate deals stats (no revenue split information)
  const dealsStats = [
    { label: 'Total Deals', value: deals.length.toString(), change: '+18%', icon: Heart, color: 'emerald' },
    { label: 'Win Rate', value: '32%', change: '+2%', icon: Percent, color: 'blue' },
    { label: 'Active Deals', value: '12', change: '+3', icon: Target, color: 'violet' },
    { label: 'Closing Soon', value: '8', change: '+2', icon: Award, color: 'orange' },
  ];

  // Calculate meetings stats
  const meetingsStats = [
    { label: 'Total Meetings', value: meetings.length.toString(), change: '+4', icon: Video, color: 'emerald' },
    { label: 'Avg Duration', value: '0m', change: '+0', icon: Clock, color: 'blue' },
    { label: 'Avg Sentiment', value: 'Neutral', change: '+0', icon: TrendingUp, color: 'violet' },
    { label: 'Avg Coach Rating', value: '0/10', change: '+0', icon: Award, color: 'orange' },
  ];

  // Select stats based on active tab
  const getStatsForTab = () => {
    switch (activeTab) {
      case 'contacts':
        return contactsStats;
      case 'deals':
        return dealsStats;
      case 'meetings':
        return meetingsStats;
      case 'companies':
      default:
        return companiesStats;
    }
  };

  const currentStats = getStatsForTab();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {currentStats.map((stat, idx) => (
        <motion.div
          key={`${activeTab}-${idx}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-lg bg-${stat.color}-500/10`}>
              <stat.icon className={`w-4 h-4 text-${stat.color}-600 dark:text-${stat.color}-400`} />
            </div>
            <span className={`text-xs font-medium ${
              stat.change.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {stat.change}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

export default ViewSpecificStats;