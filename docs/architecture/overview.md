# Architecture Overview

This document provides a comprehensive view of the Sixty Sales Dashboard architecture.

## System Architecture

```mermaid
graph TB
    subgraph Users["Users"]
        U1[Sales Reps]
        U2[Admins]
        U3[Managers]
    end

    subgraph Frontend["Frontend Layer"]
        FE[React 18 App]
        RQ[React Query]
        ZS[Zustand Store]
        RT[React Router]
    end

    subgraph API["API Layer"]
        VF[Vercel Functions]
        EF[Edge Functions]
    end

    subgraph Backend["Backend Layer"]
        SB[Supabase]
        PG[(PostgreSQL)]
        RS[Real-time]
        AU[Auth]
    end

    subgraph Integrations["External Integrations"]
        FA[Fathom]
        GC[Google Calendar]
        SL[Slack]
        JC[JustCall]
    end

    U1 & U2 & U3 --> FE
    FE --> RQ
    RQ --> ZS
    FE --> RT
    RQ --> VF
    RQ --> EF
    VF --> SB
    EF --> SB
    SB --> PG
    SB --> RS
    SB --> AU
    FA --> EF
    GC --> EF
    SL --> EF
    JC --> EF
```

---

## Component Architecture

### Frontend Structure

```mermaid
graph LR
    subgraph Pages["Pages"]
        P1[Dashboard]
        P2[Deals]
        P3[Contacts]
        P4[Calendar]
        P5[Insights]
        P6[Admin]
    end

    subgraph Components["Components (138+)"]
        C1[UI Components]
        C2[Feature Components]
        C3[Layout Components]
    end

    subgraph State["State Management"]
        S1[React Query Cache]
        S2[Zustand Stores]
        S3[Local State]
    end

    subgraph Services["Services"]
        SV1[API Services]
        SV2[Business Logic]
        SV3[Utilities]
    end

    Pages --> Components
    Components --> State
    Components --> Services
```

### Directory Structure

```
src/
├── components/           # React components
│   ├── admin/            # Admin dashboard
│   ├── CRM/              # CRM features
│   ├── Pipeline/         # Deal pipeline
│   ├── calendar/         # Calendar integration
│   ├── calls/            # Call recording
│   ├── contacts/         # Contact management
│   ├── deals/            # Deal management
│   ├── email/            # Email sync
│   ├── insights/         # Analytics
│   ├── meetings/         # Meeting intelligence
│   ├── settings/         # User settings
│   ├── ui/               # Reusable UI
│   └── workflows/        # Automation
├── pages/                # Page components
├── lib/
│   ├── services/         # Business logic
│   ├── hooks/            # Custom hooks
│   ├── utils/            # Utilities
│   ├── database/         # DB helpers
│   ├── api/              # API clients
│   └── types/            # TypeScript types
└── contexts/             # React contexts
```

---

## Database Architecture

### Entity Relationship

```mermaid
erDiagram
    USERS ||--o{ DEALS : owns
    USERS ||--o{ CONTACTS : owns
    USERS ||--o{ ACTIVITIES : creates
    USERS ||--o{ TASKS : assigned

    DEALS ||--o{ ACTIVITIES : has
    DEALS }o--|| CONTACTS : linked_to
    DEALS ||--o{ PROPOSALS : has

    CONTACTS ||--o{ ACTIVITIES : has
    CONTACTS ||--o{ MEETINGS : attends

    MEETINGS ||--o{ TRANSCRIPTS : has
    MEETINGS ||--o{ ACTION_ITEMS : generates

    ORGANIZATIONS ||--o{ USERS : contains
    ORGANIZATIONS ||--o{ INTEGRATIONS : has
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with admin flags |
| `organizations` | Multi-tenant orgs |
| `deals` | Sales deals/opportunities |
| `contacts` | CRM contacts |
| `activities` | Activity log |
| `meetings` | Meeting records |
| `tasks` | Task management |

---

## Data Flow

### Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RQ as React Query
    participant EF as Edge Function
    participant RLS as Row Level Security
    participant DB as PostgreSQL

    C->>RQ: Request Data
    RQ->>RQ: Check Cache
    alt Cache Hit
        RQ-->>C: Return Cached
    else Cache Miss
        RQ->>EF: API Request
        EF->>RLS: Auth Check
        RLS->>DB: Query
        DB-->>RLS: Results
        RLS-->>EF: Filtered Data
        EF-->>RQ: Response
        RQ->>RQ: Update Cache
        RQ-->>C: Return Data
    end
```

### Real-time Updates

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant SB as Supabase
    participant DB as PostgreSQL

    U1->>SB: Update Deal
    SB->>DB: Write
    DB-->>SB: Confirm
    SB-->>U1: Success
    SB->>U2: Real-time Event
    U2->>U2: Update UI
```

---

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant SB as Supabase Auth
    participant DB as Database

    U->>FE: Login Request
    FE->>SB: Auth Request
    SB->>SB: Validate Credentials
    SB-->>FE: JWT Token
    FE->>FE: Store Token
    FE->>DB: API Request + Token
    DB->>DB: RLS Check
    DB-->>FE: Authorized Data
```

### Row Level Security

```mermaid
graph TD
    subgraph RLS["Row Level Security"]
        R1[User owns row?]
        R2[User in same org?]
        R3[User is admin?]
        R4[Allow access]
        R5[Deny access]
    end

    Request --> R1
    R1 -->|Yes| R4
    R1 -->|No| R2
    R2 -->|Yes| R3
    R2 -->|No| R5
    R3 -->|Yes| R4
    R3 -->|No| R5
```

---

## Integration Architecture

```mermaid
graph TB
    subgraph Core["Core Platform"]
        API[Edge Functions]
        DB[(PostgreSQL)]
        Queue[Job Queue]
    end

    subgraph Fathom["Fathom Integration"]
        F1[Webhook Handler]
        F2[Meeting Sync]
        F3[Transcript Parser]
    end

    subgraph Google["Google Integration"]
        G1[OAuth Handler]
        G2[Calendar Sync]
        G3[File Search API]
    end

    subgraph Slack["Slack Integration"]
        S1[OAuth Handler]
        S2[Deal Room Channels]
        S3[Notifications]
    end

    F1 --> API
    F2 --> Queue
    F3 --> DB
    G1 --> API
    G2 --> Queue
    G3 --> DB
    S1 --> API
    S2 --> Queue
    S3 --> DB
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph Dev["Development"]
        D1[Local Dev]
        D2[Supabase Branch]
    end

    subgraph CI["CI/CD"]
        C1[GitHub Actions]
        C2[Type Checking]
        C3[Tests]
    end

    subgraph Prod["Production"]
        P1[Vercel]
        P2[Supabase Prod]
        P3[Edge Network]
    end

    D1 --> C1
    D2 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> P1
    C3 --> P2
    P1 --> P3
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend | React 18 | Industry standard, hooks, concurrent features |
| Build | Vite | Fast HMR, optimized builds |
| State | React Query | Server state, caching, real-time |
| UI State | Zustand | Simple, lightweight |
| Styling | Tailwind | Utility-first, consistent |
| Backend | Supabase | BaaS, real-time, RLS |
| Database | PostgreSQL | Relational, mature, extensible |
| Hosting | Vercel | Edge network, serverless |
