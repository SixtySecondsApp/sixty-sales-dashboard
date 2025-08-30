# API Testing Interface - Design Specifications

## Overview

A comprehensive API testing interface that seamlessly integrates with the Sixty Sales Dashboard's glassmorphism design system, providing developers with a powerful and beautiful tool for exploring and testing CRM API endpoints.

## Design System Consistency

### Visual Design Language
- **Glassmorphism Effects**: `bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl`
- **Border System**: `border border-gray-800/50 hover:border-gray-700/60`
- **Shadow Hierarchy**: `shadow-lg hover:shadow-xl hover:shadow-2xl`
- **Color Palette**: Gray-900/Gray-800 base with Emerald accent colors
- **Typography**: System fonts with proper hierarchy and contrast

### Animation Framework
- **Framer Motion**: Consistent with existing pages
- **Hover Effects**: `scale: 1.02, y: -2` for cards
- **Stagger Animations**: 0.05s delays for list items
- **Page Transitions**: Opacity and transform animations

## Component Architecture

### 1. Page Header
```tsx
<motion.div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 backdrop-blur-sm rounded-xl border border-emerald-500/20">
      <Code2 className="h-6 w-6 text-emerald-400" />
    </div>
    <div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent">
        API Testing
      </h1>
      <p className="text-sm text-gray-400 mt-1">Test and explore your CRM API endpoints</p>
    </div>
  </div>
</motion.div>
```

**Design Features:**
- Emerald accent icon container with glassmorphism
- Gradient text heading for visual hierarchy
- Descriptive subtitle with muted color

### 2. Statistics Dashboard
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  <StatCard title="API Keys" value="2" icon={<Key />} />
  <StatCard title="Requests Today" value="134" sub="+12%" trend="up" icon={<Server />} />
  <StatCard title="Avg Response" value="245ms" sub="Within SLA" icon={<Zap />} />
  <StatCard title="Success Rate" value="99.2%" sub="Last 30 days" trend="up" icon={<CheckCircle />} />
</div>
```

**StatCard Component Design:**
- Glassmorphism background with hover effects
- Gradient overlays on hover
- Trend indicators with color coding
- Icon integration with proper spacing

### 3. Examples Sidebar (Responsive)

#### Layout Structure
```
┌─────────────────────┐
│ Example Requests    │
├─────────────────────┤
│ 🔍 Search Box       │
│ [All][Deals][Users] │
├─────────────────────┤
│ ┌─ GET  Deals ────┐ │
│ │ Get All Deals   │ │
│ │ Retrieve all... │ │
│ └─────────────────┘ │
│ ┌─ POST Deals ────┐ │
│ │ Create New Deal │ │
│ │ Create a new... │ │
│ └─────────────────┘ │
└─────────────────────┘
```

**Design Features:**
- Sticky positioning for desktop
- Collapsible on mobile
- Method badges with color coding
- Search and filter functionality

### 4. Main Interface Panel

#### Tab Navigation
```tsx
<TabsList className="bg-transparent border-0 p-4 gap-2 flex-wrap">
  <TabsTrigger value="request-builder" className="bg-gray-800/50 data-[state=active]:bg-emerald-500/20">
    <Terminal className="h-4 w-4 mr-2" />
    Request Builder
  </TabsTrigger>
  <TabsTrigger value="templates">
    <BookOpen className="h-4 w-4 mr-2" />
    Templates
  </TabsTrigger>
  <TabsTrigger value="history">
    <History className="h-4 w-4 mr-2" />
    History
  </TabsTrigger>
  <TabsTrigger value="api-keys">
    <Key className="h-4 w-4 mr-2" />
    API Keys
  </TabsTrigger>
</TabsList>
```

**Design Features:**
- Glassmorphism tab styling
- Active state with emerald accent
- Icon + text labels
- Responsive flex-wrap layout

## 5. Enhanced Code Editor Component

### Features
- **Syntax Highlighting**: JSON, cURL, JavaScript support
- **Line Numbers**: Optional display with proper alignment
- **Validation**: Real-time JSON validation with visual feedback
- **Copy/Download**: Built-in clipboard and file export
- **Expand/Collapse**: Full-screen editing mode
- **Format**: Auto-format JSON with proper indentation

### Visual Design
```tsx
<CodeEditor
  title="Request Headers"
  language="json"
  value={JSON.stringify(headers, null, 2)}
  onChange={handleHeaderChange}
  showValidation={true}
  showCopyButton={true}
  minHeight={120}
  maxHeight={400}
/>
```

**Styling:**
- Glassmorphism container
- Syntax-highlighted content overlay
- Toolbar with format/copy/expand buttons
- Status bar with validation feedback

## Tab Content Specifications

### Request Builder Tab
```
┌─ Request Builder ──────────────────── [Save as Template] ┐
├──────────────────────────────────────────────────────────┤
│ [GET ▼] [https://api.example.com/endpoint    ] [Send]     │
├──────────────────────────────────────────────────────────┤
│ Headers                                     [Format][📋] │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ {                                          1 │        │ │
│ │   "Authorization": "Bearer token",         2 │        │ │
│ │   "Content-Type": "application/json"       3 │        │ │
│ │ }                                          4 │        │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ Request Body (POST/PUT)                     [Format][📋] │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ {                                          1 │        │ │
│ │   "title": "New Deal",                     2 │        │ │
│ │   "value": 5000                            3 │        │ │
│ │ }                                          4 │        │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Response Section
```
┌─ Response ───────── [200 OK] [234ms] [2.1KB] [📋] ┐
├───────────────────────────────────────────────────┤
│ Headers                                           │
│ ┌───────────────────────────────────────────────┐ │
│ │ content-type: application/json         1 │    │ │
│ │ x-ratelimit-remaining: 58              2 │    │ │
│ └───────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────┤
│ Response Body                            [📋][⬇] │
│ ┌───────────────────────────────────────────────┐ │
│ │ {                                      1 │    │ │
│ │   "success": true,                     2 │    │ │
│ │   "data": [...]                        3 │    │ │
│ │ }                                      4 │    │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### Templates Tab
```
┌─ Request Templates ──────────────── 3 templates ┐
├──────────────────────────────────────────────────┤
│ ┌─ GET  ────┐ ┌─ POST ────┐ ┌─ PUT  ────┐      │
│ │ User Prof  │ │ New Deal   │ │ Update    │  [🗑] │
│ │ Get auth   │ │ Create new │ │ Modify    │      │
│ │ user info  │ │ deal rec   │ │ activity  │      │
│ │            │ │            │ │           │      │
│ │ 2024-01-15 │ │ 2024-01-14 │ │ 2024-01-13│      │
│ │ [📂] Load  │ │ [📂] Load  │ │ [📂] Load │      │
│ └────────────┘ └────────────┘ └───────────┘      │
└──────────────────────────────────────────────────┘
```

### History Tab
```
┌─ Request History ─────────────── 12 requests [Clear History] ┐
├───────────────────────────────────────────────────────────────┤
│ ┌ GET  [200] 234ms ──────────────── 2024-01-20 14:30:00 ┐    │
│ │ https://api.example.com/deals                          │    │
│ └────────────────────────────────────────────────────────┘    │
│ ┌ POST [201] 456ms ──────────────── 2024-01-20 14:25:00 ┐    │
│ │ https://api.example.com/deals                          │    │
│ └────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### API Keys Tab
```
┌─ Manage API Keys ────────────────────── [+ Generate Key] ┐
├──────────────────────────────────────────────────────────┤
│ Name        │ Key         │ Permissions │ Usage   │ Actions │
├──────────────────────────────────────────────────────────┤
│ Dev Key     │ sk_dev_... │ read,write  │ ████▌   │ ⚙️ 🗑    │
│ Prod Key    │ sk_prod_.. │ read        │ ███████ │ ⚙️ 🗑    │
└──────────────────────────────────────────────────────────┘
```

## Interaction Design

### User Flow Patterns

#### 1. Quick Test Flow
1. User lands on Request Builder tab
2. Method selector defaults to GET
3. URL autocomplete suggests common endpoints
4. Headers auto-populate with auth token
5. Click Send → View response
6. Copy cURL command for external use

#### 2. Template Creation Flow
1. Build request in Request Builder
2. Click "Save as Template"
3. Modal appears with name/description fields
4. Save → Template appears in Templates tab
5. Templates can be loaded with one click

#### 3. History Navigation Flow
1. Execute requests to build history
2. History tab shows recent requests
3. Click history item → loads request + response
4. Can re-execute or modify loaded request

### Keyboard Shortcuts
- **Ctrl/Cmd + Enter**: Execute request
- **Ctrl/Cmd + S**: Save as template
- **Ctrl/Cmd + K**: Focus endpoint URL
- **Escape**: Close modals

## Responsive Design

### Breakpoints
- **Mobile** (320px-767px): Stacked layout, collapsible sidebar
- **Tablet** (768px-1023px): Side-by-side with compressed sidebar
- **Desktop** (1024px+): Full three-column layout

### Mobile Adaptations
- Examples sidebar becomes bottom sheet
- Tab navigation stacks vertically
- Code editors get mobile-optimized toolbars
- Touch-friendly button sizing (44px minimum)

## Performance Considerations

### Code Splitting
- Syntax highlighter loaded on demand
- Tab content lazy-loaded
- Large response bodies virtualized

### Memory Management
- Request history limited to 50 items
- Template storage optimized
- Code editor content cleanup

### Loading States
- Skeleton screens for initial load
- Progressive loading for large responses
- Optimistic updates for template saves

## Accessibility

### Screen Reader Support
- Semantic HTML structure
- ARIA labels for interactive elements
- Status announcements for requests
- Focus management in modals

### Keyboard Navigation
- Tab order follows visual flow
- All functionality keyboard accessible
- Focus indicators clearly visible
- Escape key handling

### Color Contrast
- WCAG AA compliance (4.5:1 minimum)
- Status colors distinguishable
- High contrast mode support

## Integration Points

### CRM Data Integration
- Real-time API key management
- Usage statistics from backend
- Request templates synced to user account
- History persistence across sessions

### Security Features
- API key masking in UI
- Request sanitization
- Rate limit visualization
- Permission-based feature access

## Future Enhancements

### Advanced Features
- **Mock Server**: Built-in response mocking
- **Test Suites**: Automated API test sequences
- **Documentation**: Auto-generate API docs
- **Collaboration**: Share requests with team
- **Environments**: Dev/staging/prod configurations

### Performance Monitoring
- Response time charts
- Error rate tracking
- API health monitoring
- Usage analytics dashboard

This comprehensive design specification ensures the API testing interface provides an excellent developer experience while maintaining perfect consistency with the existing Sixty Sales Dashboard design system.