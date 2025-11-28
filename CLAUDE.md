# Sixty Sales Dashboard - Complete Documentation

A modern, high-performance sales CRM and analytics platform built with React, TypeScript, Vite, and Supabase.

## 🎯 Core Purpose

Enterprise-grade sales CRM and analytics platform featuring a streamlined 4-stage pipeline (SQL → Opportunity → Verbal → Signed), intelligent proposal workflow automation, and smart task generation. Built for high-performance sales teams with comprehensive admin controls, revenue split functionality, and automated workflow optimizations.

## 🚀 Key Features

### 🔐 Admin Security Features
- **Role-Based Access Control**: Multi-level permission system with `is_admin` flag
- **Admin-Only Deal Splitting**: Revenue split functionality restricted to administrators
- **Pipeline Protection**: Non-admins cannot delete split deals or edit critical financial data
- **Audit Logging**: Comprehensive audit trail for all administrative actions
- **Impersonation Controls**: Secure user impersonation for support scenarios

### 💰 Financial Management
- **Revenue Split Tracking**: Separate one-off and monthly recurring revenue (MRR)
- **LTV Calculations**: Business rule: `LTV = (MRR × 3) + One-off Revenue`
- **Deal Value Protection**: Split deals are protected from unauthorized modifications
- **Financial Validation**: Real-time validation and calculation of deal values
- **Payment Reconciliation**: Automated payment tracking and reconciliation engine

### 📊 Enhanced CRM Features
- **Simplified 4-Stage Pipeline**: Streamlined SQL → Opportunity → Verbal → Signed workflow
- **Smart Proposal Workflows**: Proposal confirmation modal with automatic activity creation
- **Smart Tasks Automation**: PostgreSQL-triggered task generation with configurable templates
- **Enhanced QuickAdd Component**: Improved duplicate detection and mobile-optimized interface
- **Deal Wizard**: Multi-step deal creation with intelligent data validation
- **Pipeline Management**: Drag-and-drop kanban boards with automatic stage transitions
- **Activity Tracking**: Comprehensive logging of outbound activities, meetings, proposals
- **Contact Management**: Integrated contact system with fuzzy matching and normalization
- **Task Management**: Automated task creation with smart follow-up scheduling

### 🤖 Meeting Intelligence (AI Search)
- **Automatic Indexing**: Meetings are automatically queued for AI search indexing when transcripts are synced from Fathom
- **Semantic Search**: Search across all meeting transcripts, summaries, and action items using natural language
- **Google File Search Integration**: Meetings are indexed to Google's File Search API for RAG queries
- **Background Processing**: Queue-based indexing with retry logic and exponential backoff
- **Org-Level Stores**: Each organization has its own File Search store for data isolation
- **Real-time Status**: Track indexing progress (e.g., "295/334 indexed") on the Meeting Intelligence page

### 📅 Google Calendar Integration
- **Manual Sync Control**: User-initiated calendar synchronization (no automatic syncing)
- **Smart Event Import**: Sync last 7 days of calendar events for testing
- **Database-First Architecture**: Events stored locally for instant loading
- **Conflict Resolution**: Intelligent handling of duplicate events with composite keys
- **Event Linking**: Automatic association with contacts based on email matching
- **Real-time Updates**: Live calendar data synchronization when requested
- **Error Recovery**: Robust error handling with detailed logging

### 🎨 User Experience
- **Consolidated Navigation**: Unified /admin, /crm, and /insights hubs with legacy redirects
- **Responsive Design**: Mobile-first approach with touch-optimized interactions
- **Dark Theme**: Modern dark UI with glassmorphism effects
- **Real-time Updates**: Live data synchronization across all views
- **Smart Date Selection**: Intelligent quick-date options and calendar integration
- **Performance Animations**: Framer Motion animations for enhanced UX
- **Error Resolution**: Fixed React rendering issues and improved component stability

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** with TypeScript for type-safe component development
- **Vite** for lightning-fast development and optimized production builds
- **Tailwind CSS** for utility-first styling and responsive design
- **Framer Motion** for smooth animations and transitions
- **React Query** for intelligent data fetching and caching
- **Zustand** for lightweight state management

### Backend Infrastructure
- **Supabase** as primary backend-as-a-service platform
- **PostgreSQL** for robust relational data storage with automated triggers
- **Smart Task System**: Database triggers for automated task creation
- **Stage Migration System**: Automated pipeline stage transitions with audit tracking
- **Row Level Security (RLS)** for data access control
- **Edge Functions** for serverless API endpoints
- **Real-time subscriptions** for live data updates

### Performance Optimizations
- **Memory Usage Reduction**: 64.1% reduction in memory consumption
- **Component Re-renders**: Reduced by 80% through React.memo optimization
- **Financial Calculations**: 99% performance improvement (100ms → 1ms)
- **Intelligent Caching**: 85% cache hit rate for frequently accessed data
- **Virtual Scrolling**: For large data tables and lists

## 🔧 Core Components

### AdminUtils (`/src/lib/utils/adminUtils.ts`)
Central authorization system for admin-only features:
- `isUserAdmin()` - Check admin privileges
- `canSplitDeals()` - Authorize revenue splitting
- `canRemoveSplitDeals()` - Control split deal deletion
- `canEditDeal()` - Determine deal editing permissions
- `canDeleteDeal()` - Control deal deletion based on ownership and split status

### QuickAdd Component (`/src/components/QuickAdd.tsx`)
Enhanced activity creation interface with React error fixes:
- **Multi-Action Support**: Tasks, deals, sales, outbound activities, meetings, proposals
- **React Error Resolution**: Fixed objects rendered as children issue (#31)
- **Enhanced Duplicate Detection**: Fuzzy matching with company name normalization
- **Mobile Optimization**: Touch-friendly interface with improved accessibility
- **Admin Revenue Split**: One-off and MRR tracking (admin-only)
- **Smart Validation**: Context-aware field validation and requirements
- **Deal Integration**: Automatic deal linking and creation workflows
- **Date Intelligence**: Smart quick-date selection with custom options

### ProposalConfirmationModal Component (`/src/components/ProposalConfirmationModal.tsx`)
Intelligent proposal workflow automation:
- **Stage Transition Control**: Triggered when dragging deals to Opportunity stage
- **Smart Activity Creation**: Only creates proposal activity when user confirms
- **Automated Follow-up**: Generates 3-day follow-up task automatically
- **Workflow Prevention**: Prevents accidental proposal activity creation
- **User Experience**: Clear confirmation dialog with contextual messaging

### Smart Tasks System (`/src/components/admin/SmartTasks.tsx`)
Automated task generation with admin controls:
- **Template Management**: Admin-only interface at `/admin/smart-tasks`
- **Database Integration**: `smart_task_templates` table with trigger automation
- **Default Templates**: 5 pre-configured templates for common workflows
- **PostgreSQL Triggers**: Automatic task creation based on activity patterns
- **Configurable Delays**: Customizable follow-up timing and task priorities

### DealWizard Component (`/src/components/DealWizard.tsx`)
Comprehensive deal creation system:
- **Multi-Step Process**: Guided deal creation with validation at each step
- **Contact Integration**: Automatic contact creation and linking
- **Revenue Splitting**: Admin-controlled financial data entry
- **Stage Management**: Intelligent default stage assignment to SQL stage
- **Activity Tracking**: Automatic activity logging for deal creation
- **Pipeline Integration**: Seamless integration with 4-stage pipeline workflow

### Calendar Service (`/src/lib/services/calendarService.ts`)
Google Calendar synchronization service:
- **Manual Sync Operations**: User-controlled sync with no automatic operations
- **Flexible Sync Options**: Single event test, incremental updates, or historical sync
- **Database Integration**: Direct storage to PostgreSQL with conflict resolution
- **Event Processing**: Smart handling of recurring events and all-day events
- **Contact Linking**: Automatic association with CRM contacts via email matching
- **Error Handling**: Comprehensive error recovery and logging
- **Performance Optimized**: Batch processing with efficient database operations

## 🛡️ Security Model

### Permission Levels
1. **Super Admin**: Full system access, user management, revenue splitting, smart task management
2. **Admin**: Revenue splitting, advanced pipeline management, smart task template access
3. **Standard User**: Basic CRM functionality, own data management, pipeline interactions
4. **Read-Only**: View access only (future implementation)

### Data Protection
- **Split Deal Protection**: Non-admins cannot modify deals with revenue splits
- **Ownership Validation**: Users can only edit/delete their own non-split deals
- **Smart Task Access Control**: Admin-only access to task template management
- **Stage Migration Tracking**: Complete audit trail for pipeline stage changes
- **Input Sanitization**: All user inputs sanitized to prevent injection attacks
- **Audit Trail**: Complete logging of all data modifications including automated tasks

## 📈 Performance Metrics

### Optimization Results
- **Memory Usage**: Reduced from 89.1% to 25% stable usage
- **Component Re-renders**: Reduced by 80% through memoization
- **Financial Calculations**: 99% performance improvement
- **Console Cleanup**: Eliminated 2,827 debug statements causing memory retention
- **Backend Memory**: 67% reduction through connection pooling and caching

### Monitoring
- **Memory Monitoring**: Real-time memory usage tracking
- **Performance Metrics**: Web Vitals monitoring and reporting
- **Error Tracking**: Comprehensive error logging and alerting
- **Usage Analytics**: User behavior and feature adoption tracking

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ for development environment
- PostgreSQL database (via Supabase)
- Environment variables configured

### Installation
```bash
# Clone repository
git clone [repository-url]
cd sixty-sales-dashboard

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development Scripts
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run test` - Run test suite
- `npm run playwright` - E2E tests
- `npm run test:memory` - Memory performance tests

## 🧪 Testing Strategy

### Test Coverage
- **Unit Tests**: Component and utility function testing
- **Integration Tests**: API and database interaction testing
- **E2E Tests**: Full user workflow testing with Playwright
- **Performance Tests**: Memory usage and rendering performance
- **Security Tests**: Permission and access control validation

### Admin Permission Testing
Comprehensive test suite for admin functionality:
- Revenue splitting authorization
- Smart task template access control
- Deal deletion permissions with 4-stage pipeline
- Split deal protection across all stages
- Non-admin restrictions and workflow validation
- Proposal confirmation modal testing
- Stage migration validation testing

### Performance Testing
- Memory leak detection
- Component render optimization
- Database query performance including trigger efficiency
- API response time monitoring
- Smart task creation performance validation
- Pipeline stage transition speed testing
- React error resolution validation (Issue #31)

## 📊 Business Rules

### Revenue Calculation
- **LTV Formula**: `(Monthly MRR × 3) + One-off Revenue`
- **Annual Value**: `(Monthly MRR × 12) + One-off Revenue`
- **Split Definition**: Deal with both one-off AND monthly revenue

### Deal Lifecycle (Streamlined 4-Stage Pipeline)
1. **SQL**: Sales Qualified Lead - Initial contact and qualification
2. **Opportunity**: Proposal stage with confirmation modal workflow
3. **Verbal**: Terms agreed verbally, pending contract
4. **Signed**: Contract executed (split deals created here)

**Migration Notes**: 
- Existing deals automatically migrated from 7+ legacy stages
- `stage_migration_notes` field tracks original stage information
- Foreign key constraints handled during migration process

### Proposal Workflow Rules
- **Stage Transition**: Moving deal to "Opportunity" triggers proposal confirmation
- **Modal Confirmation**: "Have you sent a proposal?" prevents accidental activities
- **Smart Activity Creation**: Proposal activity only created when user confirms "Yes"
- **Automated Follow-up**: 3-day follow-up task automatically generated
- **Workflow Prevention**: Eliminates unintentional proposal activity creation

### Admin Controls
- Only admins can create/edit revenue splits
- Only admins can access Smart Task template management at `/admin/smart-tasks`
- Split deals cannot be deleted by non-admins
- Non-admins can delete their own non-split deals
- All admin actions are logged for audit purposes
- Smart task creation triggers are admin-configurable

### Smart Task Automation Rules
- **Template System**: 5 default templates for common workflows
- **Database Triggers**: PostgreSQL triggers create tasks based on activity patterns
- **Configurable Delays**: Admin-defined follow-up timing (default: 3 days)
- **Activity Matching**: Tasks created when specific activities occur
- **Priority Assignment**: Automated task priority based on template configuration

## 🔮 Future Enhancements

### Planned Features
- **Advanced Reporting**: Custom dashboard creation and KPI tracking
- **Integration Hub**: Slack, email, and CRM integrations
- **Mobile App**: React Native companion application
- **AI Insights**: Predictive analytics and deal scoring
- **Workflow Automation**: Automated task creation and notifications

### Technical Roadmap
- **Microservices**: Backend service decomposition
- **GraphQL**: Advanced query capabilities
- **Real-time Collaboration**: Multi-user editing and notifications
- **Advanced Caching**: Redis integration for performance
- **API Gateway**: Rate limiting and request routing

## 📋 API Documentation

### Key Endpoints
- `POST /api/deals` - Create new deal (starts in SQL stage)
- `PUT /api/deals/:id` - Update deal (admin validation, stage transition triggers)
- `DELETE /api/deals/:id` - Delete deal (permission controlled)
- `POST /api/activities` - Create activity (triggers smart task generation)
- `GET /api/dashboard` - Dashboard data aggregation
- `GET /admin/smart-tasks` - Smart task template management (admin-only)
- `POST /api/stage-migration` - Handle pipeline stage transitions

### Admin-Protected Endpoints
- Deal revenue splitting requires admin privileges
- Split deal modifications require admin authorization
- Smart task template management restricted to admins
- Audit log access restricted to admins
- Pipeline stage migration controls (admin oversight)

## 🏃‍♂️ Production Deployment

### Build Process
```bash
# Production build with optimizations
npm run build:prod

# Verify build
npm run preview
```

### Environment Setup
- Configure Supabase production database with triggers
- Deploy smart task templates and PostgreSQL triggers
- Set up Edge Functions for API endpoints
- Configure Row Level Security policies for 4-stage pipeline
- Enable audit logging and monitoring including stage migrations
- Deploy proposal confirmation modal workflows
- Configure automated task generation system

### Performance Monitoring
- Memory usage alerts
- Error rate monitoring
- Performance metric tracking
- User experience monitoring

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with comprehensive tests
3. Ensure all tests pass including admin permission tests
4. Submit pull request with detailed description

### Code Standards
- TypeScript strict mode
- ESLint and Prettier formatting
- Component testing with React Testing Library
- Performance testing for new features

### Security Requirements
- All admin features must include permission validation
- Financial data modifications require audit logging
- User input sanitization mandatory
- Performance impact assessment required

---

## 📞 Support & Maintenance

For questions about admin functionality, revenue splitting, or performance optimizations, refer to the comprehensive test suites and implementation examples in the codebase.

**Key Files for Reference:**
- `/src/lib/utils/adminUtils.ts` - Admin permission system
- `/src/components/QuickAdd.tsx` - Enhanced activity creation with React fixes
- `/src/components/ProposalConfirmationModal.tsx` - Proposal workflow automation
- `/src/components/admin/SmartTasks.tsx` - Automated task management
- `/src/components/DealWizard.tsx` - Deal creation workflow
- `/src/lib/services/calendarService.ts` - Google Calendar sync service
- `/src/lib/hooks/useCalendarEvents.ts` - Calendar event React hooks
- `/src/lib/hooks/useGoogleIntegration.ts` - Google integration hooks
- `/src/pages/Calendar.tsx` - Calendar page component
- `/test-admin-permissions.html` - Admin functionality testing
- `/MEMORY_OPTIMIZATION_COMPLETE.md` - Performance optimization details

**Database Schema Updates:**
- `smart_task_templates` table - Template configurations
- `stage_migration_notes` field - Migration audit tracking
- PostgreSQL triggers for automated task creation
- 4-stage pipeline constraints and validations
- `calendar_events` table - Google Calendar event storage
- `auto_link_calendar_event_to_contact` trigger - Fixed to use `owner_id` for contact linking
- Composite unique index on `(external_id, user_id)` for calendar events

**IMPORTANT DATABASE COLUMN NAMES:**
- **meetings table**: Uses `owner_user_id` NOT `user_id` (common integration error!)
- **calendar_events table**: Uses `user_id` for the owner
- **tasks table**: Uses `user_id` for assignment
- **deals table**: Uses `user_id` for the owner
- **activities table**: Uses `user_id` for the owner
- **contacts table**: Uses `user_id` for the owner
- **workflow_executions table**: Uses `user_id` for the owner
- **user_automation_rules table**: Uses `user_id` (references auth.users(id))
- Always verify the correct column name before writing migrations or queries!

**Edge Function Notes:**
- Edge functions use service role key which bypasses RLS
- When querying tables, explicitly select needed columns rather than using `select('*')`
- Add error logging to help debug column name issues

**Route Structure:**
- `/admin` - Consolidated admin hub with smart task management
- `/crm` - Unified CRM features with 4-stage pipeline
- `/insights` - Analytics and reporting hub
- Legacy route redirects automatically handled