# CRM Redesign MVP - Essential Wireframes

## Overview
Speed-to-market focused wireframes for enhanced Companies view with grid/list toggle, leveraging existing infrastructure and design system.

## 1. Enhanced Companies View (Priority 1)

### Current State Analysis
- **Existing**: Table-only view in `CompaniesTable.tsx`
- **Features**: Search, filters, multi-select, sorting, owner filtering
- **Design**: Dark theme with glassmorphism effects, emerald accents

### Enhanced Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ CRM Navigation (existing)                                       │
├─────────────────────────────────────────────────────────────────┤
│ Companies Header                                                │
│ ┌─ Building2 Icon + "Companies" + Filter Description           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Search & Filters Panel (enhanced existing)                     │
│ ┌─────────────────┬─────────────────┬───────────────────────────┐│
│ │ Search Input    │ Owner Filter    │ Quick Stats Bar          ││
│ │ (existing)      │ (existing)      │ [NEW COMPONENT]          ││
│ └─────────────────┴─────────────────┴───────────────────────────┘│
│ ┌─────────────────┬─────────────────┬───────────────────────────┐│
│ │ Size Filter     │ Industry Filter │ View Toggle + Actions     ││
│ │ (existing)      │ (existing)      │ [ENHANCED]               ││
│ └─────────────────┴─────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Quick Stats Bar [NEW COMPONENT]                                │
│ ┌─────────────┬─────────────┬─────────────┬─────────────────────┐│
│ │ 📊 Total    │ 🏢 Active   │ 💰 Total    │ 📈 This Month      ││
│ │ Companies   │ Deals       │ Value       │ Added              ││
│ │ 247         │ 89          │ £892K       │ +12                ││
│ └─────────────┴─────────────┴─────────────┴─────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ View Toggle & Actions [ENHANCED]                               │
│ ┌─────────────────────────────────────────────┬─────────────────┐│
│ │ [ Table ] [ Grid ]                         │ Export | Select │││
│ │ [VIEW TOGGLE - NEW]                        │ | Add Company    ││
│ └─────────────────────────────────────────────┴─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Grid View Layout [NEW COMPONENT]

```
┌─────────────────────────────────────────────────────────────────┐
│ Company Cards Grid                                              │
│ ┌─────────────┬─────────────┬─────────────┬─────────────────────┐│
│ │ Company A   │ Company B   │ Company C   │ Company D          ││
│ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────────────┐││
│ │ │ ACME    │ │ │ TechCorp│ │ │ DataInc │ │ │ StartupXYZ     │││
│ │ │ Corp    │ │ │         │ │ │         │ │ │                │││
│ │ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────────────┘││
│ │ 🌐 acme.com │ │ 🌐 tech.io│ │ 🌐 data.co│ │ 🌐 startup.ai   ││
│ │ 👥 5 contacts│ │ 👥 8      │ │ 👥 3      │ │ 👥 12           ││
│ │ 💰 £45K     │ │ 💰 £120K  │ │ 💰 £78K   │ │ 💰 £234K        ││
│ │ 📊 3 deals  │ │ 📊 7 deals│ │ 📊 2 deals│ │ 📊 15 deals     ││
│ │ [Edit][Del] │ │ [Edit][Del]│ │ [Edit][Del]│ │ [Edit][Del]     ││
│ └─────────────┴─────────────┴─────────────┴─────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Responsive Grid Breakpoints
- **Desktop (lg+)**: 4 cards per row
- **Tablet (md)**: 3 cards per row  
- **Mobile (sm)**: 2 cards per row
- **Mobile (xs)**: 1 card per row

## 2. Component Structure & Integration (Priority 2)

### Component Hierarchy

```
CompaniesView (enhanced from existing CompaniesTable)
├── CRMNavigation (existing - no changes)
├── CompaniesHeader (existing structure)
├── SearchFiltersPanel (enhanced existing)
│   ├── SearchInput (existing)
│   ├── OwnerFilter (existing) 
│   ├── QuickStatsBar [NEW]
│   └── ViewToggleActions [ENHANCED]
├── CompaniesGrid [NEW COMPONENT]
│   └── CompanyCard [NEW COMPONENT]
└── CompaniesTable (existing - minimal changes)
```

### New Components to Create

#### 1. QuickStatsBar Component
```typescript
interface QuickStatsBarProps {
  totalCompanies: number;
  activeDeals: number;
  totalValue: number;
  monthlyAdded: number;
}
```

#### 2. ViewToggle Component
```typescript
interface ViewToggleProps {
  currentView: 'table' | 'grid';
  onViewChange: (view: 'table' | 'grid') => void;
}
```

#### 3. CompanyCard Component
```typescript
interface CompanyCardProps {
  company: Company; // Reuse existing interface
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  onClick: (company: Company) => void;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}
```

### Integration Points with Existing Code

#### Data Layer (No Changes Required)
- ✅ Reuse existing `useCompanies` hook
- ✅ Reuse existing `Company` interface
- ✅ Reuse existing API endpoints
- ✅ Maintain existing search/filter logic

#### State Management (Minimal Changes)
- ✅ Add `viewMode` state: `'table' | 'grid'`
- ✅ Preserve all existing state management
- ✅ Reuse multi-select functionality in grid view

## 3. Design System Integration

### Color Scheme (Existing)
```css
/* Reuse existing dark theme */
--bg-primary: rgba(17, 24, 39, 0.5)    /* gray-900/50 */
--bg-secondary: rgba(31, 41, 55, 0.5)  /* gray-800/50 */
--border-primary: rgba(75, 85, 99, 1)  /* gray-600 */
--text-primary: rgb(255, 255, 255)     /* white */
--text-secondary: rgb(156, 163, 175)   /* gray-400 */
--accent-primary: rgb(59, 130, 246)    /* blue-500 */
--accent-emerald: rgb(16, 185, 129)    /* emerald-500 */
```

### Company Card Design Specifications

```
┌─────────────────────────────────────────────┐
│ Company Card (w-full max-w-sm)              │
│ ┌─────────────────────────────────────────┐ │
│ │ Header Section                          │ │
│ │ ┌─────────────────┬─────────────────────┐│ │
│ │ │ Company Name    │ [Edit] [Delete]    ││ │
│ │ │ Large, Bold     │ Action Buttons     ││ │
│ │ └─────────────────┴─────────────────────┘│ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Domain Section                          │ │
│ │ 🌐 company.com [external-link]         │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Tags Section                            │ │
│ │ [Enterprise] [Technology]               │ │
│ │ Size Badge   Industry Badge            │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Stats Section                           │ │
│ │ 👥 5 contacts    💰 £45,000            │ │
│ │ 📊 3 deals       📅 Updated 2d ago     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Card States & Interactions

#### Default State
- `bg-gray-900/50 border-gray-800`
- `backdrop-blur-sm` for glassmorphism
- Subtle shadow with `shadow-sm`

#### Hover State
- `hover:bg-gray-800/60`
- `hover:border-gray-700`
- Scale transform: `hover:scale-[1.02]`
- Smooth transition: `transition-all duration-200`

#### Selected State (Multi-select)
- `bg-violet-500/10 border-violet-500/40`
- Violet glow effect
- Checkbox overlay in top-right

### Mobile Optimization

#### Mobile Card Layout (< 640px)
```
┌─────────────────────────────┐
│ Mobile Company Card         │
│ ┌─────────────────────────┐ │
│ │ ACME Corporation        │ │
│ │ [Edit] [Delete]         │ │
│ └─────────────────────────┘ │
│ 🌐 acme.com                │
│ │ 👥 5    💰 £45K          │
│ │ 📊 3    📅 2d            │
│ └─────────────────────────┘
```

## 4. Implementation Strategy

### Phase 1: Core Components (Week 1)
1. Create `QuickStatsBar` component
2. Create `ViewToggle` component  
3. Create `CompanyCard` component
4. Add view mode state management

### Phase 2: Integration (Week 1)
1. Integrate new components with existing `CompaniesTable`
2. Add responsive grid layout
3. Implement view toggle functionality
4. Test multi-select in both views

### Phase 3: Polish (Week 2)
1. Animation enhancements with Framer Motion
2. Mobile responsive optimizations
3. Performance optimizations
4. User testing and feedback

## 5. Technical Requirements

### Dependencies (All Existing)
- ✅ `framer-motion` - Already installed
- ✅ `lucide-react` - Already installed  
- ✅ `tailwindcss` - Already installed
- ✅ UI components - Already available

### Browser Support
- Modern browsers with CSS Grid support
- Mobile responsive (iOS Safari, Chrome Android)
- Progressive enhancement approach

### Performance Considerations
- Lazy loading for large company lists
- Virtual scrolling for 500+ companies
- Image lazy loading for company logos
- Optimized re-renders with React.memo

## 6. Success Metrics

### User Experience
- 📊 Faster company discovery (grid view)
- 📱 Improved mobile usability
- ⚡ Quick stats visibility
- 🎯 Reduced clicks to key information

### Technical
- 🚀 Load time < 2 seconds
- 📱 Mobile performance score > 85
- ♿ Accessibility score > 90
- 🧪 Test coverage > 80%

## 7. Future Enhancements (Post-MVP)

### Advanced Grid Features
- Company logo integration
- Bulk actions in grid view  
- Drag-and-drop reordering
- Saved view preferences

### Enhanced Stats
- Interactive charts in stats bar
- Trend indicators
- Comparative analytics
- Custom KPI widgets

This wireframe specification prioritizes speed to market by maximizing reuse of existing components, data layer, and design system while adding focused enhancements that improve user experience without requiring extensive backend changes.