# Client Subscription Management MVP - Wireframes

**System Context**: Integration with existing sales dashboard for MRR tracking and client subscription management

**Design Philosophy**: Leverage existing UI patterns, minimize cognitive load, prioritize speed to market

---

## 1. Enhanced Dashboard with MRR Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Welcome back, John                                          [< October 2024 >]      │
│ Here's how your sales performance is tracking                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬─────────────────────────────────┬──────────────────┐
│ [£] Revenue                    │ [📞] Outbound                   │ [👥] Meetings    │
│ £45,500 / £50,000             │ 124 / 150                      │ 18 / 25         │
│ [====|    ] 91%               │ [======|  ] 83%                │ [====|    ] 72% │
│ ↗ +15% 📊 +23%                │ ↗ +8% 📊 +12%                  │ ↗ +5% 📊 -8%   │
└─────────────────────────────────┴─────────────────────────────────┴──────────────────┘
┌─────────────────────────────────┬─────────────────────────────────┬──────────────────┐
│ [📄] Proposals                 │ [🔄] MRR                       │ [👤] Active      │
│ 8 / 12                        │ £12,400 / £15,000              │ Clients         │
│ [====|    ] 67%               │ [======|  ] 83%                │ 24 / 30         │
│ ↗ +3% 📊 +2%                  │ ↗ +12% 📊 +8%                  │ ↗ +2 📊 +1     │
└─────────────────────────────────┴─────────────────────────────────┴──────────────────┘

**Key Features:**
- **MRR Card**: New metric card following existing design patterns
- **Active Clients Card**: Shows subscription health at a glance
- **Consistent Visual Language**: Same styling as Revenue, Outbound, Meetings, Proposals
- **Trend Indicators**: Same dual-arrow system (month-to-date vs previous period)
- **Clickable Navigation**: Cards link to relevant detail views
```

**Integration Notes:**
- Add MRR and Active Clients cards to existing 2x2 grid → 2x3 grid
- Reuse existing `MetricCard` component with new props
- Follow existing color scheme (MRR: emerald, Active Clients: violet)

---

## 2. Client List View - Minimal Table Interface

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Subscription Clients                                    [+ Add Client] [↓ Export]   │
│                                                                                     │
│ [Search clients, MRR, or status...]                           Show: [All ▼] 24 of 24│
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┬─────────────┬─────────────┬─────────────┬─────────────┬──────────┐
│ Client           │ Monthly MRR │ Status      │ Last Update │ Next Bill   │ Actions  │
├──────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────┤
│ 🏢 Acme Corp     │ £1,200 ▲    │ 🟢 Active   │ Oct 15      │ Nov 1       │ [✏️] [👁️] │
│   Basic Plan     │             │             │             │             │          │
├──────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────┤
│ 🏢 Tech Solutions│ £890 📊     │ 🟡 Paused   │ Oct 10      │ Nov 15      │ [✏️] [👁️] │
│   Pro Plan       │             │             │             │             │          │
├──────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────┤
│ 🏢 StartupXYZ    │ £450 ▼      │ 🟢 Active   │ Oct 20      │ Oct 28      │ [✏️] [👁️] │
│   Starter Plan   │             │             │             │             │          │
├──────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────┤
│ 🏢 BigCorp Ltd   │ £2,100 ▲    │ 🟢 Active   │ Oct 18      │ Nov 5       │ [✏️] [👁️] │
│   Enterprise     │             │             │             │             │          │
└──────────────────┴─────────────┴─────────────┴─────────────┴─────────────┴──────────┘

💡 Quick Actions:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Bulk Actions: [☐ Select All] [📤 Export Selected] [✉️ Send Reminders] [📊 Report] │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Familiar Table Layout**: Follows existing SalesTable.tsx patterns
- **Inline Status Toggle**: Quick status changes without modal
- **MRR Trend Indicators**: Visual arrows showing MRR growth/decline
- **Minimal Actions**: Edit and view only (following MVP scope)
- **Smart Filtering**: Status, payment status, MRR range filters
- **Responsive Design**: Mobile-first approach matching existing tables

**Integration Notes:**
- Route: `/subscriptions` or `/clients`
- Reuse existing table components and styling
- Follow activity log filtering patterns
- Integrate with existing search infrastructure

---

## 3. Deal-to-Client Conversion Flow

### 3.1 Enhanced Deal Card with Conversion Button

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Recent Deals                                        [Search by client or amount...] │
│                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [£] Acme Corp                                                    £1,200 ▶       │ │
│ │     Initial contract setup • Oct 15, 2024                       Signed          │ │
│ │     🎯 Convert to Subscription  [💚 Set up MRR]                               │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [£] Tech Solutions                                               £890 ▶         │ │
│ │     Q4 consulting package • Oct 10, 2024                        Signed          │ │
│ │     📋 One-time deal                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Conversion Modal

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ✨ Convert Deal to Subscription                                              [✕]   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ 🏢 **Client:** Acme Corp                                                           │
│ 💰 **Deal Value:** £1,200                                                          │
│                                                                                     │
│ ┌─── Subscription Details ────────────────────────────────────────────────────────┐ │
│ │                                                                                 │ │
│ │ Monthly Recurring Revenue                                                       │ │
│ │ ┌─────────────────────────────────────────────┐                               │ │
│ │ │ £ [1200.00]                                 │ 💡 Based on deal value        │ │
│ │ └─────────────────────────────────────────────┘                               │ │
│ │                                                                                 │ │
│ │ Billing Start Date                                                              │ │
│ │ ┌─────────────────────────────────────────────┐                               │ │
│ │ │ [November 1, 2024 ▼]                       │                               │ │
│ │ └─────────────────────────────────────────────┘                               │ │
│ │                                                                                 │ │
│ │ Plan/Service Type                                                               │ │
│ │ ┌─────────────────────────────────────────────┐                               │ │
│ │ │ [Basic Plan ▼]                              │                               │ │
│ │ └─────────────────────────────────────────────┘                               │ │
│ │                                                                                 │ │
│ │ Notes (Optional)                                                                │ │
│ │ ┌─────────────────────────────────────────────┐                               │ │
│ │ │ Monthly consulting retainer based on...     │                               │ │
│ │ └─────────────────────────────────────────────┘                               │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│                                     [Cancel] [🚀 Create Subscription]           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Smart Defaults**: Pre-populate MRR from deal value
- **Simple Form**: Only essential fields for MVP
- **Visual Confirmation**: Clear client and deal context
- **Quick Setup**: One-click conversion from existing deal data

**Integration Notes:**
- Add conversion button to existing deal cards
- Reuse modal patterns from existing system
- Create new subscription record linked to original deal
- Update deal status to "Converted to Subscription"

---

## 4. Inline Client Management - Quick Edit

### 4.1 Click-to-Edit MRR

```
┌──────────────────┬─────────────┬─────────────┬─────────────┬─────────────┬──────────┐
│ Client           │ Monthly MRR │ Status      │ Last Update │ Next Bill   │ Actions  │
├──────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────┤
│ 🏢 Acme Corp     │ ┌─────────┐ │ 🟢 Active   │ Oct 15      │ Nov 1       │ [✓] [✕]  │
│   Basic Plan     │ │£[1200]  │ │             │             │             │          │
│                  │ └─────────┘ │             │             │             │          │
├──────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────┤
│ 🏢 Tech Solutions│ £890 📊     │ [Active ▼]  │ Oct 10      │ Nov 15      │ [✏️] [👁️] │
│   Pro Plan       │             │ 🟢 Active   │             │             │          │
│                  │             │ 🟡 Paused   │             │             │          │
│                  │             │ 🔴 Cancelled│             │             │          │
└──────────────────┴─────────────┴─────────────┴─────────────┴─────────────┴──────────┘

💡 Quick Edit Features:
- Click MRR amount → Editable input field
- Click Status → Dropdown selector
- Changes auto-save with visual feedback
- Undo option for 5 seconds after change
```

### 4.2 Status Change Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Confirm Status Change                                                       [✕]   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ Change **Tech Solutions** from **Active** to **Paused**?                           │
│                                                                                     │
│ This will:                                                                          │
│ • Stop billing on next cycle (Nov 15)                                              │
│ • Reduce MRR by £890 starting next month                                           │
│ • Keep client data and history intact                                              │
│                                                                                     │
│ Reason (Optional):                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Temporary hold - client requested pause until Q1                               │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│                                               [Cancel] [⏸️ Pause Subscription]     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Inline Editing**: No separate pages for simple changes
- **Smart Validation**: Prevent invalid MRR values
- **Impact Preview**: Show MRR impact of status changes
- **Audit Trail**: Track all changes with timestamps and reasons
- **Undo Capability**: Safety net for accidental changes

---

## 5. Navigation Integration

### 5.1 Updated Sidebar Navigation

```
┌─────────────────────────────────────────────┐
│ [Logo] Sales Dashboard                      │
├─────────────────────────────────────────────┤
│ 📊 Dashboard                                │
│ 📈 Activity Log                             │
│ 🔥 Heatmap                                  │
│ 🚀 Sales Funnel                             │
│ ⚡ Pipeline                                  │
│ ✅ Tasks                                     │
├─────────────────────────────────────────────┤
│ 🔄 Subscriptions               NEW!         │
├─────────────────────────────────────────────┤
│ 🏢 Companies                                │
│ 👤 Contacts                                 │
│ 📍 Profile                                  │
└─────────────────────────────────────────────┘
```

### 5.2 Mobile Navigation

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ☰ Sales Dashboard                                                            [👤]   │
└─────────────────────────────────────────────────────────────────────────────────────┘

Mobile Menu (Expanded):
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ✕ Menu                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ 📊 Dashboard                                                                        │
│ 📈 Activity Log                                                                     │
│ 🔄 Subscriptions                              🆕 New!                              │
│ ⚡ Pipeline                                                                         │
│ 🏢 Companies                                                                        │
│ 👤 Contacts                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Integration Notes:**
- Add "Subscriptions" between "Tasks" and "Companies"
- Use recurring arrow icon (🔄) for subscription concept
- Maintain existing navigation patterns and styling
- Mobile: collapse into hamburger menu following current pattern

---

## 6. Technical Integration Points

### 6.1 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MVP Data Flow                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ Existing Deals ──┐                                                                  │
│                  ├─→ Conversion Process ──→ New Subscription Record                 │
│ Manual Entry ────┘                                                                  │
│                                                                                     │
│ Subscription Record:                                                                │
│ {                                                                                   │
│   id: string                                                                        │
│   client_name: string                                                               │
│   monthly_mrr: number                                                               │
│   status: 'active' | 'paused' | 'cancelled'                                        │
│   plan_type: string                                                                 │
│   start_date: date                                                                  │
│   next_billing: date                                                                │
│   source_deal_id?: string  // Link to originating deal                             │
│   notes?: string                                                                    │
│ }                                                                                   │
│                                                                                     │
│ Dashboard MRR Calculation:                                                          │
│ SUM(monthly_mrr WHERE status = 'active')                                           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Component Reuse Strategy

```
Reusable Components from Existing System:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ MetricCard → MRR Dashboard Cards                                                    │
│ SalesTable → Client Subscription Table                                             │
│ EnhancedStatCard → MRR Statistics                                                  │
│ Modal Components → Deal Conversion Modal                                           │
│ Badge Components → Status Indicators                                               │
│ Button/Input → All form elements                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

New Components Needed:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ClientSubscriptionTable → Main client list view                                    │
│ ConvertDealModal → Deal-to-subscription conversion                                 │
│ InlineEditMRR → Quick MRR editing                                                  │
│ StatusChangeConfirmation → Status change modal                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. User Experience Flow

### 7.1 Primary User Journey: Sales Rep Daily Usage

```
1. 📊 Dashboard View
   ↓ See MRR status at a glance
   
2. 🔄 Check subscriptions needing attention
   ↓ Click "Subscriptions" nav
   
3. 📋 Client List Review
   ↓ Quick scan of status, upcoming renewals
   
4. ⚡ Quick Actions
   ↓ Inline edit MRR, update status
   
5. 🎯 Deal Conversion (when applicable)
   ↓ Convert closed deals to subscriptions
```

### 7.2 Secondary Journey: Deal Conversion

```
1. 📈 Close Deal in Pipeline
   ↓ Deal shows "Signed" status
   
2. 💡 Convert to Subscription
   ↓ "Set up MRR" button appears
   
3. ⚙️ Subscription Setup
   ↓ Quick form with smart defaults
   
4. ✅ Confirmation
   ↓ Client added to subscription list
   
5. 📊 MRR Updated
   ↓ Dashboard reflects new recurring revenue
```

---

## 8. MVP Success Metrics

### 8.1 Key Performance Indicators

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ MVP Success Metrics                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ Adoption Metrics:                                                                   │
│ • % of sales reps using MRR dashboard daily                                        │
│ • # of deals converted to subscriptions                                            │
│ • Time spent in subscription management vs other areas                             │
│                                                                                     │
│ Efficiency Metrics:                                                                 │
│ • Time to convert deal → subscription (target: <2 minutes)                         │
│ • Client status updates per day (indicates active management)                      │
│ • MRR visibility frequency (dashboard views)                                       │
│                                                                                     │
│ Business Impact:                                                                    │
│ • Total MRR tracked vs actual recurring revenue                                    │
│ • Subscription churn visibility (status changes tracked)                           │
│ • Deal conversion rate improvement                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Future Enhancement Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Post-MVP Features (for future consideration)                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ Phase 2 - Enhanced Tracking:                                                       │
│ • Automated billing integration                                                    │
│ • Churn prediction alerts                                                          │
│ • MRR growth analytics                                                             │
│ • Customer health scoring                                                          │
│                                                                                     │
│ Phase 3 - Advanced Features:                                                       │
│ • Multi-currency support                                                           │
│ • Contract term tracking                                                           │
│ • Renewal forecasting                                                              │
│ • Revenue recognition                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

**Week 1-2: Core Infrastructure**
- Add MRR and Active Clients cards to dashboard
- Create basic subscription data model
- Set up navigation and routing

**Week 3-4: Client Management**
- Build client subscription table
- Implement inline editing
- Add status management

**Week 5-6: Deal Integration**
- Add conversion buttons to deal cards
- Build conversion modal
- Link deals to subscriptions

**Week 7-8: Polish & Testing**
- Mobile responsiveness
- Error handling
- User acceptance testing

This wireframe system prioritizes speed to market while maintaining consistency with your existing design patterns. The MVP focuses on essential MRR visibility and basic client management, providing immediate value to sales reps without overwhelming complexity.