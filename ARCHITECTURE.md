# Versatile Timesheet Tracker — Complete Architecture & Codebase Overview

A full-stack enterprise timesheet management system built with modern web technologies. This document provides a comprehensive technical overview of the codebase architecture, database design, and system connectivity.

---

## Table of Contents

1. [Project Purpose & Features](#1-project-purpose--features)
2. [Tech Stack Overview](#2-tech-stack-overview)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Database Architecture & Connectivity](#4-database-architecture--connectivity)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [API Communication Flow](#7-api-communication-flow)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Core Features & Data Models](#9-core-features--data-models)
10. [Development Setup](#10-development-setup)
11. [Adding New Features](#11-adding-new-features)

---

## 1. Project Purpose & Features

### Purpose
The **Versatile Timesheet Tracker** is an enterprise-grade web application designed to manage employee timesheets, approvals, and workforce data across multiple organizational roles and hierarchies.

### Key Features by Role

| Role | Capabilities |
|------|-------------|
| **Employee** | Create & submit weekly timesheets; log hours per project/activity; track approval status; view personal history |
| **Manager** | View direct reports' timesheets; approve/reject submissions with comments; track team compliance |
| **HR/Admin** | Full system access; manage employees, clients, projects, activities; bulk operations; export data; view audit logs; configure settings |

### Core Workflows
- **Timesheet Creation**: Employees create timesheets for specific weeks, fill in daily hours (with optional time ranges)
- **Approval Flow**: Managers review and approve/reject timesheets; employees receive notifications
- **Client Submission**: HR can mark timesheets as submitted to external clients
- **Audit & Compliance**: All changes tracked with comprehensive audit logs
- **Export**: Bulk export to Excel/CSV for reporting and integration

---

## 2. Tech Stack Overview

### Frontend Stack (`artifacts/timesheet-portal/`)
```
Framework:           React 18 + TypeScript
Build Tool:          Vite (fast, modern bundler)
Routing:             Wouter (lightweight alternative to React Router)
State Management:    
  - Server State:    TanStack Query (React Query) v5
  - Client State:    React Context
UI Components:       shadcn/ui (built on Radix UI primitives)
Styling:             Tailwind CSS v4
Utilities:
  - Date handling:   date-fns
  - Notifications:   Sonner (toast notifications)
  - Form validation: Zod (schema validation)
```

### Backend Stack (`artifacts/api-server/`)
```
Runtime:             ASP.NET Core 9 (C# 13)
ORM:                 Entity Framework Core 9
Database Adapter:    Npgsql (PostgreSQL)
Session Management:  PostgreSQL-backed distributed cache
Logging:             Serilog (console & structured logging)
Data Export:         ClosedXML (Excel), CsvHelper (CSV)
API Style:           RESTful JSON API
Authentication:      Server-side session cookies (no OAuth)
```

### Database & Tooling
```
Database:            PostgreSQL 14+
Schema Management:   Drizzle ORM (Node.js, TypeScript-first)
Package Manager:     pnpm (fast, efficient workspaces)
Monorepo Setup:      pnpm workspaces
API Contract:        OpenAPI 3.x spec + Orval code generation
```

---

## 3. Monorepo Structure

The project uses **pnpm workspaces** to organize code into logical packages:

```
Versatile Timesheet Tracker/
├── artifacts/                          # Application packages
│   ├── api-server/                     # ASP.NET Core backend
│   │   ├── Program.cs                  # App bootstrap & DI setup
│   │   ├── Controllers/                # API endpoints (13 controllers)
│   │   ├── Repositories/               # Data access layer
│   │   ├── Models/                     # Entity & DTO definitions
│   │   ├── Data/                       # EF Core DbContext
│   │   ├── Helpers/                    # Utilities (auth, ID gen, IP tracking)
│   │   ├── Middleware/                 # Auth filters & interceptors
│   │   └── appsettings.json            # Config (logging, DB connection)
│   │
│   ├── timesheet-portal/               # React frontend
│   │   ├── src/
│   │   │   ├── main.tsx                # React entry point
│   │   │   ├── App.tsx                 # Router & auth setup
│   │   │   ├── pages/                  # 19 page components (routes)
│   │   │   ├── components/             # Reusable UI components
│   │   │   │   ├── layout/             # App shell, sidebar, header
│   │   │   │   └── ui/                 # shadcn/ui components
│   │   │   ├── hooks/                  # Custom React hooks
│   │   │   ├── lib/                    # Utilities & helpers
│   │   │   └── index.css               # Global Tailwind styles
│   │   └── index.html                  # HTML template
│   │
│   └── mockup-sandbox/                 # Component preview sandbox
│       ├── src/
│       │   ├── components/             # Shared component library
│       │   └── hooks/                  # Shared hooks
│       └── vite.config.ts
│
├── lib/                                # Shared libraries
│   ├── api-client-react/               # Auto-generated React hooks
│   │   ├── src/
│   │   │   ├── custom-fetch.ts         # Fetch wrapper with auth
│   │   │   ├── index.ts                # Public API
│   │   │   └── generated/              # Auto-generated from OpenAPI
│   │   └── tsconfig.json
│   │
│   ├── api-spec/                       # OpenAPI specification
│   │   ├── openapi.yaml                # API contract
│   │   └── orval.config.ts             # Code generation config
│   │
│   ├── api-zod/                        # Zod validation schemas
│   │   ├── src/
│   │   │   └── generated/              # Auto-generated from OpenAPI
│   │   └── tsconfig.json
│   │
│   └── db/                             # Database schema & utilities
│       ├── drizzle.config.ts           # Drizzle configuration
│       └── src/
│           └── schema/                 # Drizzle table definitions
│               ├── employees.ts        # Employee table + enums
│               ├── timesheets.ts       # Timesheet & rows tables
│               ├── projects.ts         # Project table
│               ├── clients.ts          # Client table
│               ├── activities.ts       # Activity table
│               ├── notifications.ts    # Notification table
│               ├── audit-logs.ts       # Audit log table
│               └── sessions.ts         # Session cache table
│
├── scripts/                            # Build & utility scripts
│   └── src/hello.ts
│
├── package.json                        # Root workspace config
├── pnpm-workspace.yaml                 # Workspace definitions
├── tsconfig.base.json                  # Base TypeScript config
├── tsconfig.json                       # Root TypeScript config
└── config.json                         # DeepSeek API config (NEW)
```

---

## 4. Database Architecture & Connectivity

### 4.1 Database Setup & Connection Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL Database                                         │
│ - Connection: DATABASE_URL environment variable            │
│ - Schema migration: Drizzle ORM (drizzle-kit push)        │
│ - Session storage: PostgreSQL distributed cache           │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ Npgsql adapter
                           │
┌─────────────────────────────────────────────────────────────┐
│ ASP.NET Core Backend (Program.cs)                          │
│ ┌──────────────────────────────────────────────────────────┤
│ │ NpgsqlDataSourceBuilder                                  │
│ │ - Reads DATABASE_URL or appsettings.json                 │
│ │ - Converts connection string format if needed            │
│ │ - Enables unmapped types (JSONB, arrays, etc.)          │
│ └──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┤
│ │ Entity Framework Core DbContext (AppDbContext.cs)        │
│ │ - RegisteredDbSets (8 tables)                            │
│ │ - Snake_case naming convention                           │
│ │ - Relationship mapping & validation                      │
│ └──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┤
│ │ Repositories (Data Access Layer)                         │
│ │ - Encapsulate all database queries                       │
│ │ - Use both EF Core & raw Npgsql connections             │
│ │ - Pagination, filtering, bulk operations                │
│ └──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┤
│ │ PostgreSQL Session Cache                                 │
│ │ - Stores user session data (ISession)                   │
│ │ - 24-hour idle timeout                                  │
│ │ - HttpOnly, Secure cookies                              │
│ └──────────────────────────────────────────────────────────┘
```

### 4.2 Database Schema & Tables

#### **Employees Table**
```sql
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  role ENUM ('Employee', 'Manager', 'HR') DEFAULT 'Employee',
  manager_id TEXT,                    -- FK to employees (self-join)
  status ENUM ('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Hierarchy: Employees → Manager → Reports
-- Self-referential relationship for manager-employee hierarchy
```

#### **Clients Table**
```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  client_code TEXT,
  name TEXT NOT NULL,
  status ENUM ('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- External organization/customer master data
```

#### **Projects Table**
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  project_code TEXT,
  name TEXT NOT NULL,
  client_id TEXT NOT NULL,              -- FK to clients
  client_manager_name TEXT,
  client_manager_email TEXT,
  status ENUM ('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Work assignments linked to clients
-- Each project belongs to exactly one client
```

#### **Activities Table**
```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status ENUM ('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity categories (e.g., "Development", "Testing", "Documentation")
-- Shared across all projects
```

#### **Timesheets Table**
```sql
CREATE TABLE timesheets (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,            -- FK to employees
  week_start_date TEXT NOT NULL,        -- ISO date string (YYYY-MM-DD)
  week_end_date TEXT NOT NULL,          -- ISO date string
  status ENUM (
    'Draft',           -- In-progress, not submitted
    'Submitted',       -- Employee submitted, waiting approval
    'Approved',        -- Manager approved
    'Rejected',        -- Manager rejected, back to draft
    'ClientSubmitted'  -- HR submitted to external client
  ) DEFAULT 'Draft',
  total_hours FLOAT DEFAULT 0,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by TEXT,                     -- FK to employees (manager)
  rejection_comment TEXT,
  client_submitted_at TIMESTAMP,
  client_submitted_by TEXT,             -- FK to employees (HR)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Master record for weekly timesheet
-- Status drives the workflow (Draft → Submitted → Approved/Rejected)
```

#### **Timesheet Rows Table**
```sql
CREATE TABLE timesheet_rows (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL,           -- FK to timesheets
  project_id TEXT NOT NULL,             -- FK to projects
  activity_id TEXT NOT NULL,            -- FK to activities
  -- Daily hours (float, e.g., 8.5 for 8.5 hours)
  monday FLOAT DEFAULT 0,
  tuesday FLOAT DEFAULT 0,
  wednesday FLOAT DEFAULT 0,
  thursday FLOAT DEFAULT 0,
  friday FLOAT DEFAULT 0,
  saturday FLOAT DEFAULT 0,
  sunday FLOAT DEFAULT 0,
  total_hours FLOAT DEFAULT 0,         -- Calculated sum of daily hours
  comments TEXT,                        -- Row-level notes
  -- Optional time range tracking (HH:MM:SS format)
  monday_start TEXT,     monday_end TEXT,
  tuesday_start TEXT,    tuesday_end TEXT,
  wednesday_start TEXT,  wednesday_end TEXT,
  thursday_start TEXT,   thursday_end TEXT,
  friday_start TEXT,     friday_end TEXT,
  saturday_start TEXT,   saturday_end TEXT,
  sunday_start TEXT,     sunday_end TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Detail lines for a timesheet
-- One row per project-activity combination
-- Multiple rows per timesheet allowed
```

#### **Notifications Table**
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                -- FK to employees
  type ENUM (
    'TIMESHEET_APPROVED',
    'TIMESHEET_REJECTED',
    'APPROVAL_REQUESTED',
    'INFO'
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id TEXT,                      -- FK to related entity (e.g., timesheet ID)
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- In-app notification system
-- Tracks read status per user
```

#### **Audit Logs Table**
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                -- FK to employees
  action TEXT NOT NULL,                 -- e.g., 'TIMESHEET_CREATED', 'TIMESHEET_APPROVED'
  role TEXT,                            -- Employee role at time of action
  entity_type TEXT,                     -- e.g., 'Timesheet', 'Employee'
  entity_id TEXT,
  changes JSONB,                        -- Before/after values
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Complete audit trail for compliance
-- Immutable historical record of all significant actions
```

#### **Session Cache Table** (Auto-created by ASP.NET)
```sql
CREATE TABLE aspnet_session_cache (
  id TEXT PRIMARY KEY,
  absolute_expiration TIMESTAMP,
  sliding_expiration_in_seconds BIGINT,
  expiration_time TIMESTAMP,
  value BYTEA
);

-- PostgreSQL distributed session storage
-- Auto-created by Community.Microsoft.Extensions.Caching.PostgreSql
-- Stores encrypted session data (user ID, role, etc.)
```

### 4.3 Data Relationships

```
Employees (1) ──┬──→ (Many) Timesheets
                │
                ├──→ (Many) Notifications (as recipient)
                │
                ├──→ (Many) Audit Logs (as actor)
                │
                ├──→ (Many) Employees (as manager)
                │
                └──→ Self-reference (employee's manager)

Clients (1) ──→ (Many) Projects

Projects (1) ──→ (Many) Timesheet Rows

Activities (1) ──→ (Many) Timesheet Rows

Timesheets (1) ──→ (Many) Timesheet Rows
```

### 4.4 Database Connectivity Flow (Detail)

**Step 1: Initialize Npgsql Data Source** (`Program.cs`)
```csharp
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL") 
  ?? "Server=localhost;Port=5432;Database=timesheet;User Id=postgres;Password=...";

var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.EnableUnmappedTypes();  // Support JSONB, arrays
var dataSource = dataSourceBuilder.Build();
```

**Step 2: Configure EF Core** (`Program.cs`)
```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
  options.UseNpgsql(dataSource)
         .UseSnakeCaseNamingConvention());  // C# PascalCase → SQL snake_case
```

**Step 3: Register Repositories** (`Program.cs`)
```csharp
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<ITimesheetRepository, TimesheetRepository>();
// ... 5 more repositories
```

**Step 4: Use in Controllers** (e.g., `TimesheetsController.cs`)
```csharp
public class TimesheetsController : ControllerBase {
  private readonly ITimesheetRepository _timesheetRepo;
  
  public TimesheetsController(ITimesheetRepository timesheetRepo) {
    _timesheetRepo = timesheetRepo;
  }
  
  [HttpGet("timesheets/{id}")]
  public async Task<IActionResult> GetTimesheet(string id) {
    var ts = await _timesheetRepo.FindById(id);  // EF Core query
    return Ok(ts);
  }
}
```

**Step 5: Return JSON Response** (over HTTP)
```csharp
// EF Core entities → JSON (camelCase via JsonOptions)
// CamelCaseNamingPolicy converts: ApprovedAt → approvedAt
```

---

## 5. Backend Architecture

### 5.1 Architectural Layers

```
┌─────────────────────────────────────────────────────┐
│ HTTP Layer (Controllers)                            │
│ - Handle REST endpoints                             │
│ - Validate session & role                           │
│ - Call repositories                                 │
│ - Return JSON responses                             │
└─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ Business Logic Layer (Repositories)                 │
│ - Implement complex queries & business rules        │
│ - Handle pagination, filtering, sorting             │
│ - Manage transactions                               │
│ - Create audit logs                                 │
└─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ Data Access Layer (EF Core + AppDbContext)          │
│ - ORM mapping (C# objects ↔ SQL)                   │
│ - Connection pooling                                │
│ - Query optimization                                │
└─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ Database (PostgreSQL)                               │
└─────────────────────────────────────────────────────┘
```

### 5.2 Controllers (13 API Controllers)

Each controller handles a specific domain. All use RESTful patterns:

| Controller | Endpoints | Purpose |
|-----------|-----------|---------|
| **AuthController** | POST `/auth/login` (select user) | Session management |
| **EmployeesController** | GET, POST, PUT, DELETE `/employees` | Employee CRUD |
| **ClientsController** | GET, POST, PUT, DELETE `/clients` | Client master data |
| **ProjectsController** | GET, POST, PUT, DELETE `/projects` | Project master data |
| **ActivitiesController** | GET `/activities` | Activity lookup |
| **TimesheetsController** | GET, POST, PUT `/timesheets`, approve/reject | Timesheet CRUD & workflow |
| **ApprovalsController** | GET `/approvals`, bulk approve/reject | Manager approval interface |
| **NotificationsController** | GET, PUT `/notifications` | User notifications |
| **AuditLogsController** | GET `/audit-logs` | Compliance & audit trail |
| **DashboardController** | GET `/dashboard/*` | Analytics & summary data |
| **ExportController** | GET `/export/*` | Excel/CSV export |
| **SearchController** | GET `/search` | Global search |
| **ClientSubmissionsController** | GET, POST `/client-submissions` | External client integration |
| **HealthController** | GET `/health` | Service health checks |

### 5.3 Repositories (Data Access Layer)

**Pattern: Repository Interface + Implementation**

Each repository follows this interface:
```csharp
public interface ITimesheetRepository
{
  Task<PaginatedResult<object>> FindAll(int page, int pageSize, ...filters);
  Task<object?> FindById(string id);
  Task<object?> Create(...);
  Task<object?> Update(...);
  Task<bool> Delete(...);
  Task<object?> Submit(...);
  Task<object?> Approve(...);
  Task<object?> Reject(...);
  Task<(int Processed, int Succeeded, int Failed)> BulkAction(...);
}
```

**Key Features:**
- **Pagination**: All list operations support page/pageSize
- **Filtering**: Role-based queries (e.g., direct reports for managers)
- **Transactions**: Updates wrapped in db.SaveChangesAsync()
- **Audit Logging**: Create operations log changes
- **Bulk Operations**: Handle multiple records efficiently
- **Raw SQL**: Some complex queries use Npgsql directly (e.g., weekly summaries)

### 5.4 Models & Entities

**Core Entity Classes** (`Models/Entities.cs`):
- `Employee` - User representation (id, name, role, manager hierarchy)
- `Client` - External client/customer
- `Project` - Work assignment (linked to client)
- `Activity` - Work type/category
- `Timesheet` - Weekly timesheet header (status, approval metadata)
- `TimesheetRow` - Daily time entries (hours per project-activity-day)
- `Notification` - User notification record
- `AuditLog` - Audit trail entry

**Enums** (`Models/Enums.cs`):
- `Role`: Employee, Manager, HR
- `EmployeeStatus`: Active, Inactive
- `TimesheetStatus`: Draft, Submitted, Approved, Rejected, ClientSubmitted

### 5.5 Session & Authentication

**No OAuth/JWT — Simple Session-Based Auth**

```csharp
// Login (AuthController)
POST /api/auth/login
{
  "employeeId": "EMP001"
}

// Backend sets session
HttpContext.Session.SetString("UserId", userId);
HttpContext.Session.SetString("Role", role);

// Middleware (AuthFilters.cs)
[RequireRole("Manager", "HR")]  // Attribute-based authorization
public class ApprovalsController { ... }

// Session retrieval (in controllers)
var user = HttpContext.Session.GetUser();  // Helper extension method
```

**Session Storage:**
- Medium: PostgreSQL (distributed cache via `Community.Microsoft.Extensions.Caching.PostgreSql`)
- TTL: 24 hours idle timeout
- Cookies: HttpOnly, Secure, SameSite=Lax

### 5.6 Key Helpers

| Helper | Purpose |
|--------|---------|
| `SessionExtensions` | `GetUser()`, `SetUser()` for session management |
| `IdGenerator` | Generate ulid-based IDs for entities |
| `ClientIpHelper` | Extract client IP from forwarded headers |
| `AuthFilters` | `RequireRole` attribute for authorization |

---

## 6. Frontend Architecture

### 6.1 React App Bootstrap

**Entry Point**: `src/main.tsx`
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**App Setup**: `src/App.tsx`
```typescript
- Initialize TanStack Query (React Query)
- Set up Wouter router
- Configure auth guards (RequireRole, redirects)
- Wrap with QueryClientProvider + TooltipProvider
- Define all routes
```

### 6.2 Pages (Routes)

**19 Page Components** (in `src/pages/`):

| Page | Route | Roles | Purpose |
|------|-------|-------|---------|
| login | `/` | All | Role selection & session init |
| dashboard | `/dashboard` | All | Overview & quick stats |
| timesheets | `/timesheets` | Employee | My timesheet list |
| timesheet-new | `/timesheets/new` | Employee | Create new timesheet |
| timesheet-detail | `/timesheets/:id` | Employee | Edit draft timesheet |
| timesheet-detail-time | `/timesheets/:id/time` | Employee | Time-based entry mode |
| approvals | `/approvals` | Manager, HR | Approve/reject pending |
| client-submissions | `/client-submissions` | HR | Submit to external clients |
| employees | `/employees` | HR | Employee management |
| employee-profile | `/employees/:id` | HR | View/edit employee |
| clients | `/clients` | HR | Client master data |
| projects | `/projects` | HR | Project management |
| activities | `/activities` | HR | Activity management |
| notifications | `/notifications` | All | In-app notifications |
| audit-logs | `/audit-logs` | HR | Compliance & audit trail |
| settings | `/settings` | HR | System configuration |
| not-found | (404) | All | 404 page |

### 6.3 Component Structure

```
src/components/
├── layout/
│   ├── app-layout.tsx          # Main shell (sidebar, header, footer)
│   ├── sidebar.tsx             # Navigation menu (role-based)
│   └── header.tsx              # Top bar (user, breadcrumb, actions)
│
├── ui/                         # shadcn/ui components (100+)
│   ├── button.tsx
│   ├── input.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── tabs.tsx
│   ├── select.tsx
│   ├── checkbox.tsx
│   ├── badge.tsx
│   └── ... (Radix UI primitives)
│
├── forms/                      # Domain-specific forms
│   ├── timesheet-form.tsx      # Hours entry form
│   ├── employee-form.tsx       # Employee CRUD
│   ├── project-form.tsx        # Project CRUD
│   └── ...
│
├── tables/                     # Domain-specific tables
│   ├── timesheets-table.tsx
│   ├── employees-table.tsx
│   └── ...
│
└── dialogs/                    # Modal dialogs
    ├── approval-modal.tsx
    ├── export-modal.tsx
    └── ...
```

### 6.4 Custom Hooks & API Integration

**React Query Hooks** (auto-generated from OpenAPI spec):
```typescript
// From @workspace/api-client-react/generated

// Fetch hooks
const { data: timesheets, isLoading } = useGetTimesheets({
  query: { page: 1, pageSize: 10 }
});

// Mutation hooks
const { mutate: submitTimesheet } = usePostTimesheetsSubmit();
const { mutate: approveTimesheet } = usePostTimesheetsApprove();

// Caching & invalidation
queryClient.invalidateQueries({
  queryKey: getGetTimesheetsQueryKey()
});
```

**Custom Hooks** (in `src/hooks/`):
```typescript
- useAuth()                    // Current user context
- useNotifications()           // Listen for new notifications
- useTimesheetFilters()        # Filter/sort state
- usePagination()              # Pagination logic
- useExport()                  # Export functionality
```

### 6.5 API Communication

**Request Flow:**

```
React Component
  ↓ (calls generated hook)
useGetTimesheets() [React Query]
  ↓ (caches, manages state)
customFetch() [custom-fetch.ts]
  ↓ (adds baseUrl, auth headers)
fetch() [browser native]
  ↓ (HTTP request)
ASP.NET Backend
  ↓ (auth check, DB query)
HTTP Response (JSON)
  ↓
React Query cache
  ↓
Component re-renders
```

**Base URL**: Configured to `/api` (same-origin API)

### 6.6 Styling Strategy

**Tailwind CSS + shadcn/ui**
- Utility-first CSS framework
- Pre-built Radix UI components styled with Tailwind
- Custom design tokens in `tailwind.config.ts`
- Global styles in `index.css`

---

## 7. API Communication Flow

### 7.1 API Spec & Code Generation

**OpenAPI Specification** (`lib/api-spec/openapi.yaml`)
- Defines all endpoints, parameters, request/response schemas
- Single source of truth for API contract

**Orval Code Generation** (`lib/api-spec/orval.config.ts`)
```typescript
// Generates:
// 1. React Query hooks (useGetTimesheets, usePostTimesheets, etc.)
// 2. TypeScript types (Timesheet, Employee, etc.)
// 3. Zod validation schemas
```

**Generated Outputs:**
```
lib/api-client-react/src/generated/  → React Query hooks
lib/api-zod/src/generated/           → Zod validation schemas
```

### 7.2 Sample API Call Flow

**Example: Approve Timesheet**

**Frontend**:
```typescript
const { mutate: approveTimesheet } = usePostTimesheetsApprove();

approveTimesheet(
  { id: "ts-123" },  // Path param
  { comment: "Looks good!" }  // Request body
);
```

**Generated Hook** (React Query):
```typescript
export const usePostTimesheetsApprove = () => {
  return useMutation({
    mutationFn: (data) => customFetch.post(`/api/timesheets/${id}/approve`, data)
  })
}
```

**Backend Handler** (`TimesheetsController.cs`):
```csharp
[HttpPost("timesheets/{id}/approve")]
[RequireRole("Manager", "HR")]
public async Task<IActionResult> ApproveTimesheet(string id, [FromBody] ApproveRequest body)
{
  var user = HttpContext.Session.GetUser();
  var timesheet = await _timesheetRepo.Approve(id, user.Id, body.Comment);
  await _notificationRepo.Create(...);  // Notify employee
  await _auditRepo.Create(...);         // Log action
  return Ok(timesheet);
}
```

**Database Update** (`TimesheetRepository.cs`):
```csharp
public async Task<object?> Approve(string id, string approverId, string? comment)
{
  var ts = await _dbContext.Timesheets.FindAsync(id);
  ts.Status = "Approved";
  ts.ApprovedAt = DateTime.UtcNow;
  ts.ApprovedBy = approverId;
  await _dbContext.SaveChangesAsync();
  return ts;
}
```

**Response to Frontend**:
```json
{
  "id": "ts-123",
  "employeeId": "emp-456",
  "status": "Approved",
  "approvedAt": "2024-06-23T10:30:00Z",
  "approvedBy": "mgr-789"
}
```

**Frontend Update**:
```typescript
// React Query automatically invalidates cache & refetches
// Component re-renders with new status
```

---

## 8. Authentication & Authorization

### 8.1 Authentication Flow

**Simple Session-Based** (No OAuth/JWT):

1. **Login Page** (`/pages/login.tsx`):
   - User selects their employee ID from dropdown
   - Frontend calls `POST /api/auth/login { employeeId }`

2. **Backend Session Setup** (`AuthController.cs`):
   ```csharp
   [HttpPost("auth/login")]
   public async Task<IActionResult> Login([FromBody] LoginRequest body)
   {
     var employee = await _employeeRepo.FindByEmployeeId(body.EmployeeId);
     HttpContext.Session.SetString("UserId", employee.Id);
     HttpContext.Session.SetString("Role", employee.Role);
     return Ok(employee);
   }
   ```

3. **Session Persistence**:
   - Stored in PostgreSQL distributed cache
   - Cookie: `AspNetCore.Session` (HttpOnly, Secure)
   - TTL: 24 hours

4. **Current User Retrieval**:
   ```csharp
   public static SessionUser? GetUser(this ISession session)
   {
     var userId = session.GetString("UserId");
     var role = session.GetString("Role");
     return userId != null ? new SessionUser { Id = userId, Role = role } : null;
   }
   ```

### 8.2 Authorization (Role-Based Access Control)

**Attribute-Based Authorization**:
```csharp
[RequireRole("Manager", "HR")]
public class ApprovalsController { ... }

[RequireRole("HR")]
public class EmployeesController { ... }

[HttpPost("timesheets/bulk-action")]
[RequireRole("Manager", "HR")]
public async Task<IActionResult> BulkAction(...) { ... }
```

**Custom `RequireRole` Middleware** (`AuthFilters.cs`):
```csharp
public class RequireRoleAttribute : Attribute
{
  private readonly string[] _requiredRoles;
  
  public RequireRoleAttribute(params string[] roles) => _requiredRoles = roles;
  
  // Executed before controller action
  // Checks session user role against required roles
  // Returns 403 Forbidden if not authorized
}
```

**Frontend Route Guards** (`App.tsx`):
```typescript
function RequireRole({ roles, children }: Props) {
  const { data: user, isLoading } = useGetCurrentUser({
    query: { retry: false }
  });
  
  if (isLoading) return null;
  if (!user || !roles.includes(user.role)) return <Redirect to="/" />;
  return <>{children}</>;
}

// Usage
<Route path="/approvals">
  <RequireRole roles={["Manager", "HR"]}>
    <ApprovalsPage />
  </RequireRole>
</Route>
```

### 8.3 Role Hierarchy

| Role | Access Level | Responsibilities |
|------|--------------|------------------|
| **Employee** | Read own data, submit timesheets | Create/submit timesheets, view notifications |
| **Manager** | Read direct reports, approve timesheets | Approve/reject team timesheets, manage direct reports |
| **HR** | Full access | Manage all employees/projects/clients, export, audit logs, settings |

---

## 9. Core Features & Data Models

### 9.1 Timesheet Workflow

```
┌─────────────────────────────────────────────────────────┐
│ Employee                                                │
├─────────────────────────────────────────────────────────┤
│ 1. CREATE: Start new timesheet (Draft)                 │
│    - Select week                                        │
│    - Add project-activity rows                          │
│    - Enter hours per day                                │
│                                                         │
│ 2. EDIT: Modify hours, add rows, etc. (Draft)         │
│                                                         │
│ 3. SUBMIT: Lock & send for approval (→ Submitted)     │
│    - Notification sent to manager                       │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Manager                                                 │
├─────────────────────────────────────────────────────────┤
│ 4. REVIEW: View submitted timesheet details             │
│                                                         │
│ 5a. APPROVE: Accept timesheet (→ Approved)             │
│     - Notification sent to employee                     │
│     - Optional comment/feedback                         │
│                                                         │
│ 5b. REJECT: Send back for revision (→ Draft)           │
│     - Mandatory rejection comment                       │
│     - Employee can edit & resubmit                      │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ HR                                                      │
├─────────────────────────────────────────────────────────┤
│ 6. CLIENT SUBMIT: Submit to external client (→ Submitted) │
│    - Bulk action on multiple approved timesheets       │
│    - Tracks submission timestamp & HR user             │
│    - External audit trail                              │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Data Entry Modes

**Mode 1: Hours-Only Entry** (Simple)
```
Project | Activity | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Total | Comments
--------|----------|-----|-----|-----|-----|-----|-----|-----|-------|----------
PROJ-1  | Dev      | 8   | 8   | 8   | 8   | 8   | 0   | 0   | 40    |
PROJ-2  | Testing  | 0   | 0   | 0   | 0   | 2   | 4   | 4   | 10    | Weekend work
```

**Mode 2: Time-Range Entry** (Detailed)
```
Project | Activity | Mon (09:00-17:30) | Tue (09:00-17:30) | ... | Comments
--------|----------|------------------|------------------|-----|----------
PROJ-1  | Dev      | 8.5              | 8.5              | ...
```

### 9.3 Export Functionality

**Excel Export** (`ExportController.cs`):
- Uses ClosedXML library
- Generates multi-sheet workbook
- Includes summary, details, audit trail
- Can export by week, employee, or timesheet

**CSV Export**:
- Comma-separated values
- Flattened format (one row per timesheet entry)
- Easy import into analytics tools

### 9.4 Bulk Operations

**Bulk Approve/Reject**:
```csharp
POST /api/timesheets/bulk-action
{
  "timesheetIds": ["ts-1", "ts-2", "ts-3"],
  "action": "approve" | "reject",
  "comment": "..." // required for reject
}
```

**Response**:
```json
{
  "processed": 3,
  "succeeded": 3,
  "failed": 0
}
```

### 9.5 Audit & Compliance

**Audit Log Entry**:
```json
{
  "id": "audit-123",
  "userId": "emp-001",
  "action": "TIMESHEET_APPROVED",
  "role": "Manager",
  "entityType": "Timesheet",
  "entityId": "ts-456",
  "changes": {
    "status": { "from": "Submitted", "to": "Approved" },
    "approvedAt": { "from": null, "to": "2024-06-23T10:30:00Z" }
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2024-06-23T10:30:00Z"
}
```

---

## 10. Development Setup

### 10.1 Prerequisites

```
Node.js:   v18+ (for pnpm, TypeScript)
pnpm:      v8+ (package manager)
PostgreSQL: 14+ (database)
.NET SDK:  9.0+ (for C# backend)
```

### 10.2 Database Setup

**1. Create PostgreSQL Database**:
```bash
createdb versatile_timesheet
```

**2. Set DATABASE_URL**:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/versatile_timesheet"
```

**3. Run Drizzle Migrations**:
```bash
cd lib/db
pnpm install
pnpm run migrate
# or
pnpm exec drizzle-kit push
```

### 10.3 Frontend Development

```bash
cd artifacts/timesheet-portal
pnpm install
pnpm run dev
# Starts Vite dev server at http://localhost:5173
```

**Environment**:
- `VITE_API_BASE`: API base URL (default: `/api`)
- Hot reload on file changes
- Fast refresh for React components

### 10.4 Backend Development

```bash
cd artifacts/api-server
dotnet build
dotnet run
# Starts ASP.NET Core at https://localhost:7256
```

**Environment Variables**:
```
DATABASE_URL=postgresql://...
CORS_ORIGIN=http://localhost:5173
ASPNETCORE_ENVIRONMENT=Development
```

### 10.5 Full Stack Development

**Terminal 1: Frontend**
```bash
cd artifacts/timesheet-portal && pnpm run dev
```

**Terminal 2: Backend**
```bash
cd artifacts/api-server && dotnet run
```

**Terminal 3: Optional - Database migrations**
```bash
cd lib/db && pnpm run migrate --watch
```

Access app at: `http://localhost:5173`

---

## 11. Adding New Features

### 11.1 Add a New API Endpoint

**Step 1: Update OpenAPI Spec** (`lib/api-spec/openapi.yaml`):
```yaml
/api/timesheets/{id}/export:
  post:
    tags:
      - timesheets
    summary: Export timesheet as PDF
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              format:
                type: string
                enum: [pdf, excel]
    responses:
      '200':
        description: File download
        content:
          application/pdf: {}
```

**Step 2: Create Backend Controller Method**:
```csharp
// TimesheetsController.cs
[HttpPost("timesheets/{id}/export")]
[RequireRole("Manager", "HR")]
public async Task<IActionResult> ExportTimesheet(
  string id,
  [FromBody] ExportRequest body)
{
  try {
    var timesheet = await _timesheetRepo.FindById(id);
    if (timesheet == null) return NotFound();
    
    byte[] fileData = body.Format == "pdf"
      ? GeneratePdf(timesheet)
      : GenerateExcel(timesheet);
    
    return File(fileData, "application/octet-stream", $"timesheet-{id}.{body.Format}");
  }
  catch (Exception e) {
    return StatusCode(500, new { error = e.Message });
  }
}
```

**Step 3: Implement Repository Method** (if needed):
```csharp
// TimesheetRepository.cs
public async Task<byte[]> ExportAsExcel(string id)
{
  var ts = await FindById(id);
  var rows = await _dbContext.TimesheetRows
    .Where(r => r.TimesheetId == id)
    .ToListAsync();
  
  using (var workbook = new XLWorkbook()) {
    var ws = workbook.Worksheets.Add("Timesheet");
    // Populate worksheet...
    using (var stream = new MemoryStream()) {
      workbook.SaveAs(stream);
      return stream.ToArray();
    }
  }
}
```

**Step 4: Regenerate API Client** (from OpenAPI):
```bash
cd lib/api-spec
pnpm run generate
# Generates new React Query hook: usePostTimesheetsExport()
```

**Step 5: Use in Frontend**:
```typescript
// pages/timesheet-detail.tsx
const { mutate: exportTimesheet } = usePostTimesheetsExport();

const handleExport = (format: "pdf" | "excel") => {
  exportTimesheet(
    { id: timesheetId },
    { format }
  );
};

return (
  <button onClick={() => handleExport("pdf")}>Export as PDF</button>
);
```

### 11.2 Add a New Database Table

**Step 1: Define Drizzle Schema** (`lib/db/src/schema/new-entity.ts`):
```typescript
import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["Active", "Inactive"]);

export const newEntitiesTable = pgTable("new_entities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: statusEnum("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewEntity = typeof newEntitiesTable.$inferSelect;
```

**Step 2: Export from Index** (`lib/db/src/schema/index.ts`):
```typescript
export * from "./new-entity";
```

**Step 3: Push to Database**:
```bash
cd lib/db
pnpm run migrate  # or drizzle-kit push
```

**Step 4: Create EF Core Entity** (`Models/Entities.cs`):
```csharp
public class NewEntity
{
  public string Id { get; set; } = "";
  public string Name { get; set; } = "";
  public string Status { get; set; } = "Active";
  public DateTime CreatedAt { get; set; }
  public DateTime UpdatedAt { get; set; }
}
```

**Step 5: Add DbSet** (`Data/AppDbContext.cs`):
```csharp
public DbSet<NewEntity> NewEntities => Set<NewEntity>();

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
  modelBuilder.Entity<NewEntity>(entity =>
  {
    entity.ToTable("new_entities");
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Status).HasColumnType("text");
  });
}
```

**Step 6: Create Repository**:
```csharp
public interface INewEntityRepository { ... }
public class NewEntityRepository : INewEntityRepository { ... }
```

**Step 7: Register in DI** (`Program.cs`):
```csharp
builder.Services.AddScoped<INewEntityRepository, NewEntityRepository>();
```

### 11.3 Add a New Frontend Page

**Step 1: Create Page Component** (`pages/new-feature.tsx`):
```typescript
import { useGetNewEntities } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";

export default function NewFeaturePage() {
  const { data: entities, isLoading } = useGetNewEntities();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold">New Feature</h1>
        {/* Component implementation */}
      </div>
    </AppLayout>
  );
}
```

**Step 2: Add Route** (`App.tsx`):
```typescript
import NewFeaturePage from "@/pages/new-feature";

<Route path="/new-feature">
  <RequireRole roles={["HR"]}>
    <NewFeaturePage />
  </RequireRole>
</Route>
```

**Step 3: Add Navigation** (`components/layout/sidebar.tsx`):
```typescript
if (user.role === "HR") {
  navItems.push({
    label: "New Feature",
    href: "/new-feature",
    icon: "NewFeatureIcon"
  });
}
```

### 11.4 Common Patterns

**React Query Pattern**:
```typescript
const { data, isLoading, error } = useGetTimesheets({
  query: { page: 1, pageSize: 10 }
});

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
```

**Mutation Pattern**:
```typescript
const { mutate, isPending } = usePostTimesheets();

const handleSubmit = async (data) => {
  mutate(data, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetTimesheetsQueryKey() });
      toast.success("Timesheet created!");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
};
```

**Form Pattern** (with Zod validation):
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTimesheetSchema } from "@workspace/api-zod";

const form = useForm({
  resolver: zodResolver(insertTimesheetSchema),
  defaultValues: {}
});

<form onSubmit={form.handleSubmit(onSubmit)}>
  <input {...form.register("weekStartDate")} />
  {form.formState.errors.weekStartDate && (
    <span>{form.formState.errors.weekStartDate.message}</span>
  )}
</form>
```

---

## Summary: Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User (Browser)                                                  │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │ HTTP/JSON (REST)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ React Frontend (Vite)                                           │
│ - React 18 component (timesheet-detail.tsx)                     │
│ - TanStack Query manages state & caching                        │
│ - useGetTimesheet hook (auto-generated from OpenAPI)            │
│ - Custom fetch wrapper (sets base URL, handles errors)          │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │ HTTP/JSON
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ ASP.NET Core Backend (Kestrel)                                  │
│ - TimesheetsController.GetTimesheet (REST endpoint)             │
│ - RequireRole("Manager", "HR") authorization check              │
│ - ITimesheetRepository.FindById (business logic)                │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │ EF Core ORM + Npgsql
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ PostgreSQL Database                                             │
│ - AppDbContext (ORM mapping)                                    │
│ - SQL queries to timesheets, timesheet_rows, employees tables  │
│ - Returns typed entities (Timesheet, TimesheetRow, etc.)       │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │ Entities → JSON
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend Response (JSON)                                         │
│ {                                                               │
│   "id": "ts-123",                                               │
│   "employeeId": "emp-456",                                      │
│   "weekStartDate": "2024-06-17",                                │
│   "status": "Draft",                                            │
│   "totalHours": 40,                                             │
│   "rows": [...]                                                 │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │ HTTP 200
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ React Query Caching & Component Render                          │
│ - Cache stores response                                         │
│ - Component receives data via hook                              │
│ - UI renders timesheet details                                  │
│ - User can edit hours → mutate → POST back to backend           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps for Enhancement

- **Authentication**: Upgrade from session-based to JWT/OAuth for mobile support
- **Real-time Notifications**: Integrate WebSockets for push notifications
- **Mobile App**: React Native or Flutter wrapper using the same backend API
- **Advanced Reporting**: Business intelligence dashboards (Power BI, Tableau)
- **Workflow Automation**: Approval chains, escalation rules
- **Integration**: Sync with HR systems (Workday, BambooHR)
- **Performance**: Add caching layer (Redis), optimize database queries

---

## Conclusion

This is a **production-ready timesheet management system** with:
- ✅ Monorepo architecture for scalability
- ✅ Type-safe API contracts (OpenAPI → auto-generated code)
- ✅ Secure session-based auth + role-based access control
- ✅ PostgreSQL with Drizzle for schema management
- ✅ React 18 + modern tooling (Vite, TanStack Query)
- ✅ Comprehensive audit trail & compliance logging
- ✅ Export functionality (Excel, CSV)
- ✅ Notification system for approval workflows

The architecture supports easy addition of new features while maintaining code quality and type safety across the full stack.
