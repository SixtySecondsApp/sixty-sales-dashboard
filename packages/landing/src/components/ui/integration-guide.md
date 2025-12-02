# Enhanced StatCard Integration Guide

## Quick Integration Steps

### 1. Install the Enhanced StatCard
The component is already created at:
- `src/components/ui/enhanced-stat-card.tsx`
- `src/components/ui/activity-stats-example.tsx`

### 2. Update SalesTable Component

Replace the existing StatCard implementation in `src/components/SalesTable.tsx`:

```typescript
// Remove the old StatCard component and replace with:
import { EnhancedStatCard } from '@/components/ui/enhanced-stat-card';
import { UserX } from 'lucide-react'; // Add for no-show icon

// In the stats grid section, replace StatCard usage:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
  <EnhancedStatCard
    title="Total Revenue"
    primaryValue={`£${currentStats.totalRevenue.toLocaleString()}`}
    percentageValue={75.3} // vs target or total pipeline
    trendPercentage={calculateTrend(currentStats.totalRevenue, previousStats.totalRevenue)}
    periodContext="vs last month"
    icon={PoundSterling}
    color="emerald"
    onClick={() => handleFilterByType('sale')}
  />
  
  <EnhancedStatCard
    title="Meeting Conversion"
    primaryValue={`${currentStats.meetingToProposalRate}%`}
    secondaryValue="meetings → proposals"
    trendPercentage={currentStats.meetingToProposalRate - previousStats.meetingToProposalRate}
    periodContext="vs last month"
    icon={Users}
    color="cyan"
    onClick={() => handleFilterByType('meeting')}
  />
  
  <EnhancedStatCard
    title="Proposal Win Rate"
    primaryValue={`${currentStats.proposalWinRate}%`}
    secondaryValue="proposals → sales"
    trendPercentage={currentStats.proposalWinRate - previousStats.proposalWinRate}
    periodContext="vs last month"
    icon={FileText}
    color="blue"
    onClick={() => handleFilterByType('proposal')}
  />
  
  <EnhancedStatCard
    title="Won Deals"
    primaryValue={currentStats.activeDeals}
    secondaryValue="closed this period"
    trendPercentage={calculateTrend(currentStats.activeDeals, previousStats.activeDeals)}
    periodContext="vs last month"
    icon={BarChartIcon}
    color="violet"
    onClick={() => handleFilterByType('sale')}
  />
  
  <EnhancedStatCard
    title="Average Deal Value"
    primaryValue={`£${Math.round(currentStats.avgDeal).toLocaleString()}`}
    trendPercentage={calculateTrend(currentStats.avgDeal, previousStats.avgDeal)}
    periodContext="vs last month"
    icon={PoundSterling}
    color="emerald"
    onClick={() => handleFilterByType('sale')}
  />
  
  {/* NEW: No-Show Rate Card */}
  <EnhancedStatCard
    title="No-Show Rate"
    primaryValue={`${currentStats.noShowRate.toFixed(1)}%`}
    secondaryValue={`${currentStats.noShowCount} of ${currentStats.totalMeetings} meetings`}
    trendPercentage={currentStats.noShowRate - previousStats.noShowRate}
    periodContext="vs last month"
    icon={UserX}
    color="orange"
    variant="no-show"
    onClick={() => handleFilterByStatus('no-show')}
  />
</div>
```

### 3. Add Helper Functions

Add these utility functions to calculate trends and no-show metrics:

```typescript
// Add to SalesTable component
const calculateTrend = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

const calculateNoShowStats = (activities: Activity[]) => {
  const meetingsAndCalls = activities.filter(a => 
    a.type === 'meeting' || a.type === 'call'
  );
  const noShows = activities.filter(a => a.status === 'no-show');
  
  return {
    totalMeetings: meetingsAndCalls.length,
    noShowCount: noShows.length,
    noShowRate: meetingsAndCalls.length > 0 
      ? (noShows.length / meetingsAndCalls.length) * 100 
      : 0
  };
};

// Add filter handler for no-shows
const handleFilterByStatus = (status: string) => {
  setFilters(prev => ({
    ...prev,
    status: prev.status === status ? undefined : status
  }));
};
```

### 4. Update Stats Calculations

Enhance your existing stats calculations to include no-show data:

```typescript
// In your useMemo for currentStats, add:
const currentNoShowStats = calculateNoShowStats(currentActivities);
const previousNoShowStats = calculateNoShowStats(previousActivities);

const currentStats = {
  // ... existing stats
  ...currentNoShowStats,
};

const previousStats = {
  // ... existing stats  
  ...previousNoShowStats,
};
```

### 5. Update Grid Responsive Classes

Change the grid classes to accommodate the new 6-column layout:

```typescript
// From:
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"

// To:
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6"
```

## Benefits of the Enhanced Design

### 1. Better Visual Hierarchy
- Clear separation of primary and secondary values
- Trend indicators moved to top-right corner
- Consistent spacing and typography

### 2. More Information, Less Clutter
- Primary value with optional percentage context
- Secondary value for additional context
- Period-specific trend indicators
- Clean, organized layout

### 3. New No-Show Rate Metric
- Tracks lost opportunities
- Special variant styling
- Inverse trend logic (lower is better)
- Contextual secondary information

### 4. Professional Dashboard Feel
- Consistent animations and interactions
- Color-coded metrics
- Hover effects and click handlers
- Responsive grid system

### 5. Enhanced Accessibility
- Better color contrast
- Clear trend indicators
- Semantic HTML structure
- Keyboard navigation support

## Customization Options

### Period Context
```typescript
// Dynamic period based on date filter
const getPeriodContext = (rangeType: DateRangePreset) => {
  switch (rangeType) {
    case 'today': return 'vs yesterday';
    case 'thisWeek': return 'vs last week';
    case 'thisMonth': return 'vs last month';
    case 'thisQuarter': return 'vs last quarter';
    default: return 'vs previous period';
  }
};
```

### Custom Colors
```typescript
// Add custom colors to colorClasses
purple: {
  bg: 'bg-purple-500/10',
  border: 'border-purple-500/20', 
  text: 'text-purple-500',
  hover: 'hover:border-purple-500/50'
}
```

### Additional Variants
```typescript
// Add more specialized variants
variant?: 'default' | 'no-show' | 'target' | 'warning';
```

This enhanced design provides a much more professional, informative, and user-friendly dashboard experience while maintaining the existing functionality.