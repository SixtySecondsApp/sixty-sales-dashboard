# Enhanced StatCard Design Specifications

## Visual Design System

### Layout Structure
```
┌─────────────────────────────────────────────────┐
│ [Icon]                           [Trend+Period] │
│                                                 │
│ Title                                           │
│ Primary Value (Percentage)                      │
│ Secondary Value                                 │
│ ────────────────── (for no-show only)          │
│ [UserX Icon] Lost Opportunities                 │
└─────────────────────────────────────────────────┘
```

### Typography Hierarchy
- **Title**: `text-sm font-medium text-gray-400` - Clear labeling
- **Primary Value**: `text-2xl font-bold text-white` - Main focus
- **Percentage**: `text-sm font-medium [color]` - Contextual accent
- **Secondary Value**: `text-sm text-gray-500` - Supporting information
- **Trend Text**: `text-xs font-medium` - Compact indicator
- **Period Context**: `text-xs text-gray-500` - Time reference

### Spacing System
- **Card Padding**: `p-5` (20px) - Comfortable breathing room
- **Icon Container**: `p-2.5` (10px) - Proportional icon space
- **Section Spacing**: `mb-4, mt-3, pt-3` - Clear content separation
- **Element Gaps**: `gap-1, gap-2` - Consistent micro-spacing

## Color Scheme

### Metric Colors
```typescript
emerald: Revenue, positive growth metrics
cyan: Conversion rates, customer metrics
blue: Success rates, completion metrics
violet: Deal counts, volume metrics
orange: Warning metrics, no-show rates
red: Critical metrics, negative indicators
yellow: Pending/waiting metrics
```

### Trend Colors
```typescript
// Standard metrics (higher is better)
positive: 'text-emerald-500' // Green for growth
negative: 'text-red-500'     // Red for decline
neutral: 'text-gray-500'     // Gray for no change

// No-show metrics (lower is better)
improving: 'text-emerald-500' // Green for reduction
worsening: 'text-red-500'     // Red for increase
```

## Component Specifications

### EnhancedStatCard Props
```typescript
interface EnhancedStatCardProps {
  title: string;                    // Metric name
  primaryValue: string | number;    // Main display value
  secondaryValue?: string | number; // Additional context
  percentageValue?: number;         // Percentage representation
  trendPercentage?: number;         // Change from previous period
  periodContext: string;            // "vs last month", "vs last week"
  icon: React.ElementType;          // Lucide React icon
  color: ColorVariant;              // Theme color
  variant?: 'default' | 'no-show'; // Special handling
  onClick?: () => void;             // Interactive handler
  className?: string;               // Additional styling
}
```

### Usage Examples
```tsx
// Revenue Card
<EnhancedStatCard
  title="Total Revenue"
  primaryValue="£24,567"
  percentageValue={75.3}
  trendPercentage={12.4}
  periodContext="vs last month"
  icon={PoundSterling}
  color="emerald"
/>

// No-Show Rate Card
<EnhancedStatCard
  title="No-Show Rate"
  primaryValue="8.2%"
  secondaryValue="3 of 37 meetings"
  trendPercentage={-2.1}
  periodContext="vs last month"
  icon={UserX}
  color="orange"
  variant="no-show"
/>
```

## Responsive Grid Layout

### Breakpoint Strategy
```css
/* Mobile: Stack vertically */
grid-cols-1 sm:grid-cols-2

/* Tablet: 2-3 columns */
md:grid-cols-3

/* Desktop: 4-5 columns */
lg:grid-cols-4 xl:grid-cols-5

/* Grid gap consistent */
gap-4 md:gap-6
```

### Container Spacing
```css
/* Mobile padding */
px-4 sm:px-0

/* Responsive margins */
mb-6 md:mb-8

/* Consistent gaps */
gap-4 md:gap-6
```

## Animation Specifications

### Hover Effects
- **Card Lift**: `y: -2px` on hover
- **Border Highlight**: Color-specific border glow
- **Transition**: `duration-300` for smooth interaction

### Loading States
```tsx
// Skeleton placeholders while data loads
<div className="animate-pulse bg-gray-800/50 h-32 rounded-xl" />
```

## Accessibility Features

### Keyboard Navigation
- Focusable cards with `onClick` handlers
- Clear focus indicators
- Semantic HTML structure

### Screen Reader Support
```tsx
// Proper ARIA labels
<div role="button" aria-label={`${title}: ${primaryValue}`}>
  {/* Card content */}
</div>
```

### Color Contrast
- All text meets WCAG AA standards
- Icon colors have sufficient contrast
- Trend indicators are clearly distinguishable

## Interactive Behavior

### Click Handlers
```tsx
onClick={() => {
  // Filter data by metric type
  // Navigate to detailed view
  // Toggle expanded state
}}
```

### Visual Feedback
- Hover elevation
- Color-coded border highlights
- Smooth transitions

## Performance Considerations

### Optimization
- Memoized components for static data
- Efficient re-renders with proper keys
- Lazy loading for non-critical stats

### Bundle Impact
- Tree-shakeable icon imports
- Minimal CSS footprint
- Optimized motion components

## Implementation Guidelines

### Data Integration
```typescript
// Calculate trend percentages
const trendPercentage = ((current - previous) / previous) * 100;

// Format display values
const formattedValue = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP'
}).format(value);
```

### Error Handling
```tsx
// Graceful degradation
{trendPercentage !== undefined ? (
  <TrendIndicator value={trendPercentage} />
) : (
  <span className="text-gray-500">No trend data</span>
)}
```

### Testing Strategy
- Unit tests for calculations
- Visual regression tests
- Accessibility audits
- Performance benchmarks