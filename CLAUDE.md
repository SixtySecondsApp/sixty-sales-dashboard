# Sixty Sales Dashboard - Complete Documentation

A modern, high-performance sales CRM and analytics platform built with React, TypeScript, Vite, and Supabase.

## 🎯 Core Purpose

Enterprise-grade sales dashboard with comprehensive pipeline management, activity tracking, and financial analytics. Features robust admin controls, revenue split functionality, and comprehensive performance optimizations.

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
- **QuickAdd Component**: Streamlined creation of activities, tasks, deals, and meetings
- **Deal Wizard**: Multi-step deal creation with intelligent data validation
- **Pipeline Management**: Drag-and-drop kanban boards with stage tracking
- **Activity Tracking**: Comprehensive logging of outbound activities, meetings, proposals
- **Contact Management**: Integrated contact system with email/phone/LinkedIn tracking
- **Task Management**: Full task lifecycle with priority levels and due dates

### 🎨 User Experience
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark Theme**: Modern dark UI with glassmorphism effects
- **Real-time Updates**: Live data synchronization across all views
- **Smart Date Selection**: Intelligent quick-date options and calendar integration
- **Performance Animations**: Framer Motion animations for enhanced UX

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
- **PostgreSQL** for robust relational data storage
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
Enhanced activity creation interface:
- **Multi-Action Support**: Tasks, deals, sales, outbound activities, meetings, proposals
- **Admin Revenue Split**: One-off and MRR tracking (admin-only)
- **Smart Validation**: Context-aware field validation and requirements
- **Deal Integration**: Automatic deal linking and creation workflows
- **Date Intelligence**: Smart quick-date selection with custom options

### DealWizard Component (`/src/components/DealWizard.tsx`)
Comprehensive deal creation system:
- **Multi-Step Process**: Guided deal creation with validation at each step
- **Contact Integration**: Automatic contact creation and linking
- **Revenue Splitting**: Admin-controlled financial data entry
- **Stage Management**: Intelligent default stage assignment
- **Activity Tracking**: Automatic activity logging for deal creation

## 🛡️ Security Model

### Permission Levels
1. **Super Admin**: Full system access, user management, revenue splitting
2. **Admin**: Revenue splitting, advanced pipeline management
3. **Standard User**: Basic CRM functionality, own data management
4. **Read-Only**: View access only (future implementation)

### Data Protection
- **Split Deal Protection**: Non-admins cannot modify deals with revenue splits
- **Ownership Validation**: Users can only edit/delete their own non-split deals
- **Input Sanitization**: All user inputs sanitized to prevent injection attacks
- **Audit Trail**: Complete logging of all data modifications

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
- Deal deletion permissions
- Split deal protection
- Non-admin restrictions

### Performance Testing
- Memory leak detection
- Component render optimization
- Database query performance
- API response time monitoring

## 📊 Business Rules

### Revenue Calculation
- **LTV Formula**: `(Monthly MRR × 3) + One-off Revenue`
- **Annual Value**: `(Monthly MRR × 12) + One-off Revenue`
- **Split Definition**: Deal with both one-off AND monthly revenue

### Deal Lifecycle
1. **Lead/Opportunity**: Initial contact and qualification
2. **Proposal**: Formal proposal submitted
3. **Negotiation**: Terms and pricing discussion
4. **Signed**: Contract executed (split deals created here)
5. **Delivered**: Product/service delivered

### Admin Controls
- Only admins can create/edit revenue splits
- Split deals cannot be deleted by non-admins
- Non-admins can delete their own non-split deals
- All admin actions are logged for audit purposes

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
- `POST /api/deals` - Create new deal
- `PUT /api/deals/:id` - Update deal (admin validation)
- `DELETE /api/deals/:id` - Delete deal (permission controlled)
- `POST /api/activities` - Create activity
- `GET /api/dashboard` - Dashboard data aggregation

### Admin-Protected Endpoints
- Deal revenue splitting requires admin privileges
- Split deal modifications require admin authorization
- Audit log access restricted to admins

## 🏃‍♂️ Production Deployment

### Build Process
```bash
# Production build with optimizations
npm run build:prod

# Verify build
npm run preview
```

### Environment Setup
- Configure Supabase production database
- Set up Edge Functions for API endpoints
- Configure Row Level Security policies
- Enable audit logging and monitoring

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
- `/src/components/QuickAdd.tsx` - Enhanced activity creation
- `/src/components/DealWizard.tsx` - Deal creation workflow
- `/test-admin-permissions.html` - Admin functionality testing
- `/MEMORY_OPTIMIZATION_COMPLETE.md` - Performance optimization details