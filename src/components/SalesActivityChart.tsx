import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, subMonths, eachWeekOfInterval } from 'date-fns';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label
} from 'recharts';
import { motion } from 'framer-motion';
import { Calendar, ChevronDown } from 'lucide-react';
import { useDashboardActivities } from '@/lib/hooks/useLazyActivities';
import { useUser } from '@/lib/hooks/useUser';

interface SalesActivityChartProps {
  selectedMonth: Date;
}

const SalesActivityChart = ({ selectedMonth }: SalesActivityChartProps) => {
  const [timeframe, setTimeframe] = useState('daily');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { activities } = useDashboardActivities(selectedMonth, true);
  const { userData } = useUser();

  // Charts now using direct imports for stability

  const chartData = useMemo(() => {
    if (timeframe === 'daily') {
      // Get all days in the selected month
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      return daysInMonth.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Filter activities for this date
        const dayActivities = activities.filter(a => 
          format(new Date(a.date), 'yyyy-MM-dd') === dateStr
        );
        
        return {
          name: format(date, 'MMM d'),
          Outbound: dayActivities
            .filter(a => a.type === 'outbound')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
          Meetings: dayActivities
            .filter(a => a.type === 'meeting')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
          Proposals: dayActivities
            .filter(a => a.type === 'proposal')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
          Sales: dayActivities
            .filter(a => a.type === 'sale')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
        };
      });
    }
    
    if (timeframe === 'weekly') {
      // Get weeks in the selected month
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const firstWeekStart = startOfWeek(monthStart);
      const lastWeekEnd = endOfWeek(monthEnd);
      
      const weeks = eachWeekOfInterval({
        start: firstWeekStart,
        end: lastWeekEnd
      });
      
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        
        // Filter activities for this week
        const weekActivities = activities.filter(a => {
          const activityDate = new Date(a.date);
          return activityDate >= weekStart && activityDate <= weekEnd;
        });
        
        return {
          name: `WC ${format(weekStart, 'MMM d')}`,
          Outbound: weekActivities
            .filter(a => a.type === 'outbound')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
          Meetings: weekActivities
            .filter(a => a.type === 'meeting')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
          Proposals: weekActivities
            .filter(a => a.type === 'proposal')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
          Sales: weekActivities
            .filter(a => a.type === 'sale')
            .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
        };
      });
    }

    // Monthly view - show last 12 months up to selected month
    const monthsData = [];
    const endDate = endOfMonth(selectedMonth);
    
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(endDate, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      // Filter activities for this month
      const monthActivities = activities.filter(a => {
        const activityDate = new Date(a.date);
        return activityDate >= monthStart && activityDate <= monthEnd;
      });
      
      monthsData.push({
        name: format(date, 'MMM yyyy'),
        Outbound: monthActivities
          .filter(a => a.type === 'outbound')
          .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
        Meetings: monthActivities
          .filter(a => a.type === 'meeting')
          .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
        Proposals: monthActivities
          .filter(a => a.type === 'proposal')
          .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
        Sales: monthActivities
          .filter(a => a.type === 'sale')
          .reduce((sum, a) => sum + (a.quantity || 1), 0) || 0.1,
      });
    }
    
    return monthsData;
  }, [activities, timeframe, selectedMonth]);

  const timeframeOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  // Custom tooltip to show actual values (not log values)
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl p-3 shadow-xl">
        <p className="text-gray-400 text-sm font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="text-white font-medium">
              {entry.value > 0.1 ? Math.round(entry.value) : 0}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">
            Sales Activities Overview
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {timeframe === 'daily' ? 'Last 14 days' : 
             timeframe === 'weekly' ? 'Last 12 weeks' : 
             'Year to date'} breakdown of all sales activities
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 text-gray-300 hover:bg-[#37bd7e]/20 hover:text-white transition-all duration-300 text-sm border border-transparent hover:border-[#37bd7e]/30"
          >
            <Calendar className="w-4 h-4" />
            <span className="capitalize">{timeframe}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute right-0 mt-2 w-40 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl shadow-xl z-10"
            >
              {timeframeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTimeframe(option.value);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#37bd7e]/20 hover:text-white first:rounded-t-xl last:rounded-b-xl"
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="meetingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="proposalsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.2}/>
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            dy={10}
            scale="band"
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            dx={-10}
            scale="log"
            domain={[0.1, 'auto']}
            allowDataOverflow={false}
            tickFormatter={(value) => value <= 0.1 ? 0 : Math.round(value)}
          >
            <Label
              value="Count (log scale)"
              angle={-90}
              position="insideLeft"
              style={{ fill: '#9CA3AF', fontSize: 12 }}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              paddingTop: '1rem',
              color: '#9CA3AF',
              fontSize: '12px'
            }}
          />
          <Bar
            dataKey="Outbound"
            fill="url(#outboundGradient)"
            maxBarSize={40}
            isAnimationActive={true}
            animationDuration={1000}
            animationBegin={0}
            minPointSize={2}
          />
          <Bar
            dataKey="Meetings"
            fill="url(#meetingsGradient)"
            maxBarSize={40}
            isAnimationActive={true}
            animationDuration={1000}
            animationBegin={200}
            minPointSize={2}
          />
          <Bar
            dataKey="Proposals"
            fill="url(#proposalsGradient)"
            maxBarSize={40}
            isAnimationActive={true}
            animationDuration={1000}
            animationBegin={400}
            minPointSize={2}
          />
          <Bar
            dataKey="Sales"
            fill="url(#salesGradient)"
            maxBarSize={40}
            isAnimationActive={true}
            animationDuration={1000}
            animationBegin={600}
            minPointSize={2}
          />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesActivityChart;