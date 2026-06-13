# Versatile Timesheet Portal — Developer Guide

A full-stack web application for managing employee timesheets, approvals, and workforce data. This guide is written for developers who are new to the codebase and want to understand exactly how everything works before making changes.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [How to Run Locally](#4-how-to-run-locally)
5. [Environment Variables](#5-environment-variables)
6. [Architecture & Data Flow](#6-architecture--data-flow)
7. [Frontend — Deep Dive](#7-frontend--deep-dive)
   - [Entry Points](#71-entry-points)
   - [Routing & Auth Guards](#72-routing--auth-guards)
   - [Pages Reference](#73-pages-reference)
   - [API Hooks (Service Layer)](#74-api-hooks-service-layer)
   - [Layout & Shell](#75-layout--shell)
   - [Shared Utilities & Hooks](#76-shared-utilities--hooks)
   - [UI Components](#77-ui-components)
8. [Backend — Deep Dive](#8-backend--deep-dive)
   - [Program.cs — Application Bootstrap](#81-programcs--application-bootstrap)
   - [Models](#82-models)
   - [Session & Authentication](#83-session--authentication)
   - [Controllers Reference](#84-controllers-reference)
   - [Repositories Reference](#85-repositories-reference)
   - [Helpers](#86-helpers)
9. [Database](#9-database)
10. [Key Patterns to Understand](#10-key-patterns-to-understand)
11. [End-to-End Feature Walkthrough](#11-end-to-end-feature-walkthrough)
12. [How to Add a New Feature](#12-how-to-add-a-new-feature)
13. [Common Mistakes to Avoid](#13-common-mistakes-to-avoid)

---

## 1. Project Overview

The portal lets companies manage their weekly employee timesheets across three roles:

| Role | What they can do |
|------|-----------------|
| **Employee** | Create timesheets for each week, fill in daily hours per project/activity, submit for approval, view personal history |
| **Manager** | View and approve/reject submitted timesheets from their direct reports, see team compliance |
| **Admin** | Full access — manage employees, clients, projects, activities; bulk upload; export data; view audit logs |

There is **no real password authentication**. This is a demo/internal tool that uses a "pick who you are" login screen — a user is selected by ID and stored in a server-side session.

---

## 2. Tech Stack

### Frontend (`artifacts/timesheet-portal/`)
| What | Technology |
|------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Routing | Wouter (lightweight React router) |
| Server state | TanStack Query (React Query) v5 |
| Styling | Tailwind CSS |
| Component library | shadcn/ui (built on Radix UI primitives) |
| Date utilities | date-fns |
| Toast notifications | Sonner |

### Backend (`artifacts/api-server/`)
| What | Technology |
|------|-----------|
| Runtime | ASP.NET Core 9 (C#) |
| ORM | Entity Framework Core 9 with Npgsql adapter |
| Raw SQL | Npgsql (direct `NpgsqlConnection`) |
| Session storage | PostgreSQL via `Community.Microsoft.Extensions.Caching.PostgreSql` |
| Logging | Serilog |
| Excel export | ClosedXML |
| CSV export | CsvHelper (referenced) / manual |

### Database
| What | Technology |
|------|-----------|
| Database | PostgreSQL |
| Schema management | Drizzle ORM (Node.js tooling, `drizzle-kit push`) |

### Monorepo
| What | Technology |
|------|-----------|
| Package manager | pnpm workspaces |
| API type contract | Shared workspace package `@workspace/api-client-react` — contains auto-generated TypeScript hooks from an OpenAPI spec |

---

## 3. Repository Structure

```
/
├── artifacts/
│   ├── timesheet-portal/          # React frontend
│   │   ├── src/
│   │   │   ├── main.tsx           # React entry point (mounts App)
│   │   │   ├── App.tsx            # Router + QueryClient setup + auth guards
│   │   │   ├── index.css          # Global Tailwind styles
│   │   │   ├── pages/             # One file per page/route
│   │   │   ├── components/
│   │   │   │   ├── layout/        # App shell (sidebar, topbar)
│   │   │   │   └── ui/            # shadcn/ui building blocks
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   └── lib/               # Utility functions
│   │   ├── vite.config.ts         # Vite dev server config
│   │   └── package.json
│   │
│   └── api-server/                # C# ASP.NET Core backend
│       ├── Program.cs             # App setup (DI, middleware, routing)
│       ├── appsettings.json       # Config file (env overrides in prod)
│       ├── TimesheetApi.csproj    # Project file (NuGet packages listed here)
│       ├── Controllers/           # HTTP request handlers (one per resource)
│       ├── Repositories/          # Database access layer
│       ├── Models/                # C# data classes (entities, session types)
│       ├── Helpers/               # Small utility classes
│       ├── Middleware/            # Auth attribute filters
│       └── Data/
│           └── AppDbContext.cs    # EF Core database context
│
├── lib/
│   └── api-client-react/          # Auto-generated React Query hooks
│       └── src/
│           ├── custom-fetch.ts    # Fetch wrapper (sets base URL + credentials)
│           └── ...                # Generated hooks like useGetTimesheets, etc.
│
├── package.json                   # Root pnpm workspace config
└── drizzle/                       # Database schema & migrations (Drizzle ORM)
```

> **Key insight for freshers:** The frontend never writes raw `fetch()` calls. All HTTP communication goes through generated hooks in `@workspace/api-client-react`. Think of that package as a typed SDK for the backend.

---

## 4. How to Run Locally

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- .NET SDK 9
- A PostgreSQL database (set `DATABASE_URL`)

### Start everything

The project uses Replit's workflow system. Two processes need to run simultaneously:

**Backend (C# API):**
```bash
cd artifacts/api-server
dotnet run
# Starts on PORT env var (default 8080)
```

**Frontend (React + Vite):**
```bash
pnpm --filter @workspace/timesheet-portal run dev
# Starts on PORT env var (typically 3000)
```

### Install dependencies
```bash
# Node packages
pnpm install

# .NET packages (auto-restored on dotnet run, or manually):
cd artifacts/api-server
dotnet restore
```

### Push database schema
```bash
pnpm drizzle-kit push
# This creates/updates all tables in your PostgreSQL database
```

---

## 5. Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Backend | PostgreSQL connection string. Format: `postgres://user:pass@host:5432/dbname` |
| `PORT` | Both | Port to listen on. Replit assigns this automatically |
| `CORS_ORIGIN` | Backend | Comma-separated list of allowed frontend origins. If not set, Replit domains are allowed automatically |

The backend converts `postgres://` URI format to the Npgsql key=value format automatically via `ConvertConnectionString()` in `Program.cs`.

---

## 6. Architecture & Data Flow

```
Browser (React)
    │
    │  HTTP requests with session cookie
    ▼
ASP.NET Core API  (artifacts/api-server)
    │
    ├── Controllers      ← receives request, validates, calls repository
    │
    ├── Repositories     ← all database logic lives here
    │
    └── PostgreSQL DB
           ├── employees
           ├── timesheets
           ├── timesheet_rows
           ├── projects
           ├── clients
           ├── activities
           ├── notifications
           ├── audit_logs
           └── aspnet_session_cache  ← stores login sessions
```

### Request lifecycle (example: employee submits a timesheet)

1. Employee clicks "Submit" in the React UI
2. React calls `useSubmitTimesheet(timesheetId)` hook
3. Hook fires `POST /api/timesheets/{id}/submit` with the session cookie
4. `[RequireAuth]` filter on the controller checks the session — returns 401 if not logged in
5. `TimesheetsController.Submit()` fetches the timesheet, checks it's in "Draft" or "Rejected" status
6. Calls `TimesheetRepository.Submit(id)` which runs an atomic SQL `UPDATE ... WHERE status IN ('Draft','Rejected')`
7. If the row was already in a different status (race condition), throws `InvalidTransitionException` → controller returns 409 Conflict
8. On success, creates a `Notification` for the manager and an `AuditLog` entry
9. Returns the updated timesheet as JSON
10. React Query invalidates its cache for the timesheets list → UI refreshes automatically

---

## 7. Frontend — Deep Dive

### 7.1 Entry Points

**`src/main.tsx`**
The very first file React executes. It mounts the `<App />` component into the `#root` div in `index.html`. Nothing complex here — just bootstrapping.

**`src/App.tsx`**
This is where all the top-level wiring happens. It does four things:

1. **Creates the QueryClient** — the global cache for all API data. It's configured with `retry: 1` (retries failed requests once) and `refetchOnWindowFocus: false` (does not re-fetch data just because the user switches browser tabs).

2. **Wraps the app in providers** — `QueryClientProvider` (makes the cache available everywhere), `TooltipProvider` (Radix tooltip context), `WouterRouter` (sets the base URL path from Vite's `BASE_URL`).

3. **Defines `RequireRole`** — a small guard component. When placed around a route, it reads the current user from the session and redirects to `/` if the user's role isn't in the allowed list. This is the **client-side** role check (the backend has its own `[RequireRole]` attribute as the authoritative check).

4. **Defines the route tree** — all URL paths mapped to their page components.

---

### 7.2 Routing & Auth Guards

The app uses **Wouter** instead of React Router. The API is almost identical but Wouter is much smaller.

```tsx
// How routes work
<Route path="/timesheets" component={Timesheets} />

// How role protection works — wraps the page component
<Route path="/approvals">
  <RequireRole roles={["Manager", "Admin"]}>
    <Approvals />
  </RequireRole>
</Route>
```

**`AppLayout`** (the persistent shell with sidebar/topbar) also guards unauthenticated users. If `useGetCurrentUser()` returns no user, `AppLayout` calls `window.location.replace("/login")` — a hard redirect that also clears React Query's cache. This prevents the app from getting stuck in a loading loop.

**`SelfProfileRedirect`** is a small helper component that reads the current user's ID from the session and redirects `/profile` to `/employees/{user.id}` so any role can reach their own profile page.

---

### 7.3 Pages Reference

Each page file lives in `src/pages/`. Here is what every page does technically:

#### `login.tsx`
- Calls `useGetAuthUsers()` to load the list of all active employees from `/api/auth/users`
- Renders a grid of employee cards grouped by role
- When the user clicks a card, calls `useSelectUser({ id })` which `POST /api/auth/select-user` — this logs the user in by creating a server-side session
- On success, redirects to `/` (dashboard)
- **No passwords are involved** — this is a demo auth model

#### `dashboard.tsx`
Renders differently based on the logged-in user's role:
- **Admin/Manager**: Shows `useGetDashboardStats()` (total employees, pending approvals, compliance rate), `useGetRecentActivity()` (last N timesheet events), `useGetComplianceOverview()` (per-department breakdown)
- **Employee**: Shows `useGetDashboardMyStats()` (personal submission counts, approval rate)
- All data is shown with loading skeletons while fetching

#### `timesheets.tsx`
- Calls `useListTimesheets()` with pagination and optional status filter
- The backend automatically scopes results to the logged-in employee (Employees only see their own; Managers see their team's)
- Renders a table with status badges (Draft/Submitted/Approved/Rejected), links to detail view

#### `timesheet-new.tsx` and `timesheet-new-time.tsx`
- `timesheet-new.tsx`: Standard hours-only entry form (enter decimal hours per day per project/activity row)
- `timesheet-new-time.tsx`: Time-range entry form (enter start/end times per day — the system calculates hours)
- Both load `useListProjects()` and `useListActivities()` to populate the dropdowns
- On submit, calls `useCreateTimesheet()` which `POST /api/timesheets`
- Week start date defaults to the current Monday and cannot be changed (timesheets are weekly)

#### `timesheet-detail.tsx` and `timesheet-detail-time.tsx`
- Loads an existing timesheet by ID via `useGetTimesheet(id)`
- Employees can edit if status is "Draft" or "Rejected"; otherwise it's read-only
- Managers/Admins see an "Approve" / "Reject" button (with a comment field for rejection)
- The "Copy Previous Week" button calls `useCopyPreviousWeek()` to pre-fill the rows from the prior week

#### `approvals.tsx`
- Manager/Admin only page
- Calls `useListTimesheets({ status: "Submitted" })` to show all pending timesheets
- Supports selecting multiple rows and calling `useBulkTimesheetAction()` to approve or reject in bulk

#### `employees.tsx`
- Admin only
- Full employee directory with search, role filter, department filter
- "Add Employee" dialog calls `useCreateEmployee()`
- "Bulk Upload" uses an Excel file — download the template first via `useGetBulkUploadTemplate()`, fill it in, then upload via `useBulkUploadEmployees()`

#### `employee-profile.tsx`
- Shows a detailed profile: personal info, timesheet submission metrics (total submitted, approved, rejected, approval rate)
- Fetches from `useGetEmployeeProfile(id)` which returns `{ employee: {...}, metrics: {...} }`
- Backend enforces scoping: Employees can only see their own profile; Managers can only see their direct reports

#### `clients.tsx` and `projects.tsx`
- Admin-only CRUD pages
- Both support search, pagination, create/edit/delete
- Projects are linked to Clients (a project belongs to one client)

#### `activities.tsx`
- Admin-only list of work activity types (e.g., "Development", "Testing", "Meetings")
- Employees select activities when filling in timesheet rows

#### `audit-logs.tsx`
- Admin-only read-only log of all system actions
- Every create/update/delete/approve/reject action is recorded with: who did it, what they did, the old value, the new value, IP address

#### `notifications.tsx`
- All roles — personal notification inbox
- Notifications are created automatically when: a timesheet is submitted (manager gets notified), approved or rejected (employee gets notified)
- Mark-as-read functionality

#### `settings.tsx`
- Personal profile page for any logged-in user
- Shows their name, department, designation, manager, role
- Read-only (no editing of profile from the UI — admins do that via the Employees page)

#### `not-found.tsx`
- Standard 404 page shown when no route matches

---

### 7.4 API Hooks (Service Layer)

All API calls go through `@workspace/api-client-react`. These hooks are **auto-generated** from an OpenAPI spec — you should not write them by hand.

Every data-fetching hook follows this pattern:

```tsx
// Reading data — uses React Query's useQuery internally
const { data, isLoading, error } = useListTimesheets({
  query: { employeeId: "abc123", page: 1, pageSize: 20 }
});

// Mutating data — uses React Query's useMutation internally
const { mutate: createTimesheet, isPending } = useCreateTimesheet();
createTimesheet({ weekStartDate: "2025-01-06", rows: [...] });
```

**`custom-fetch.ts`** is the single place where the HTTP base URL and credentials are configured:
- Base URL is built from Vite's `import.meta.env.BASE_URL` so it works in both dev and production
- `credentials: "include"` is set so the session cookie is sent with every request automatically

**React Query cache behavior:**
- Data is cached in memory by a "query key" (e.g. `["timesheets", { page: 1 }]`)
- After a mutation (create/update/delete), the hook typically calls `queryClient.invalidateQueries()` to mark the relevant cache as stale and trigger a background re-fetch
- This is why the UI updates automatically after you save something — you don't manually update state

---

### 7.5 Layout & Shell

**`src/components/layout/app-layout.tsx`**

This is the persistent chrome around every authenticated page. It renders:
- **Sidebar**: Navigation links filtered by the current user's role (Employees don't see Approvals/Employees/Clients etc.)
- **Topbar**: Global search bar + notification bell
- **Main content area**: Where the current page renders

Key technical details:
- Calls `useGetCurrentUser()` on mount — if this fails, it hard-redirects to `/login`
- **Global search** uses `useDebounce` to wait 300ms after the user stops typing before firing the search API call (prevents a request on every keystroke)
- Notification count badge reads from `useListNotifications()` and counts unread items

---

### 7.6 Shared Utilities & Hooks

#### `src/lib/utils.ts` — `cn()` function
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
Used everywhere to build Tailwind class strings conditionally. Example:
```tsx
<div className={cn("px-4 py-2", isActive && "bg-blue-500", className)}>
```
`clsx` handles conditional/array logic; `twMerge` resolves Tailwind conflicts (e.g., `px-2` + `px-4` → only `px-4` wins).

#### `src/hooks/use-debounce.ts`
```typescript
useDebounce(value, delay)
```
Returns a version of `value` that only updates after `delay` ms of no changes. Used in the search bar to avoid firing API calls on every keystroke.

#### `src/hooks/use-mobile.tsx`
Returns `true` if the viewport width is below the mobile breakpoint (768px). Used by the sidebar to switch between collapsed/expanded modes.

#### `src/hooks/use-toast.ts`
Provides the `toast()` function. Call it to show a notification popup:
```typescript
toast({ title: "Saved!", description: "Timesheet submitted successfully." });
toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
```

---

### 7.7 UI Components

Everything in `src/components/ui/` is from **shadcn/ui** — a collection of accessible, unstyled-by-default components built on Radix UI. They are copied into the project (not installed as a package) so you can edit them directly.

Important ones to know:

| Component | File | What it does |
|-----------|------|-------------|
| `Button` | `button.tsx` | Standard button with variants: `default`, `destructive`, `outline`, `ghost` |
| `Badge` | `badge.tsx` | Colored pill label — used for timesheet status (Draft=grey, Submitted=blue, Approved=green, Rejected=red) |
| `Card` | `card.tsx` | White rounded box. Use `CardHeader`, `CardContent`, `CardFooter` inside it |
| `Dialog` | `dialog.tsx` | Modal popup. Use for forms (create employee, add client, etc.) |
| `Table` | `table.tsx` | Structured table with `TableHeader`, `TableBody`, `TableRow`, `TableCell` |
| `Skeleton` | `skeleton.tsx` | Grey animated placeholder shown while data is loading |
| `Select` | `select.tsx` | Dropdown selector (Radix-based, fully accessible) |
| `Input` | `input.tsx` | Text input field |
| `Toaster` | `toaster.tsx` | Must be rendered once in `App.tsx` — it's the container for toast notifications |

---

## 8. Backend — Deep Dive

### 8.1 `Program.cs` — Application Bootstrap

`Program.cs` is the single configuration file for the entire backend. It runs top to bottom when the server starts. Here is what each section does:

```csharp
// 1. DATABASE
// Reads DATABASE_URL, converts from postgres:// URI to Npgsql format,
// registers AppDbContext (EF Core) + raw NpgsqlDataSource
var connectionString = ConvertConnectionString(rawUrl);
builder.Services.AddDbContext<AppDbContext>(...);
```

```csharp
// 2. SESSION STORAGE
// Sessions are stored in a PostgreSQL table called "aspnet_session_cache"
// CreateInfrastructure = true means the table is auto-created if it doesn't exist
builder.Services.AddDistributedPostgreSqlCache(options => {
    options.ConnectionString = connectionString;
    options.TableName = "aspnet_session_cache";
    options.CreateInfrastructure = true;
});
builder.Services.AddSession(options => {
    options.IdleTimeout = TimeSpan.FromHours(24); // sessions expire after 24h of inactivity
    options.Cookie.SameSite = SameSiteMode.Lax;   // required for cross-origin cookie behaviour
});
```

```csharp
// 3. DEPENDENCY INJECTION
// Repositories are registered as "Scoped" — a new instance per HTTP request
builder.Services.AddScoped<ITimesheetRepository, TimesheetRepository>();
// ... (all other repositories)
```

```csharp
// 4. CORS
// Allows the React frontend to make requests with cookies.
// If CORS_ORIGIN env var is set, only those origins are allowed.
// Otherwise, *.replit.dev, *.repl.co, *.replit.app, localhost are allowed.
```

```csharp
// 5. MIDDLEWARE PIPELINE ORDER (important — order matters in ASP.NET Core)
app.UseSerilogRequestLogging(); // log every request
app.UseCors();                  // must be before UseSession
app.UseSession();               // must be before MapControllers
app.MapControllers();           // route requests to controllers
```

```csharp
// HELPER FUNCTION at the bottom of the file
static string ConvertConnectionString(string cs)
// Converts "postgres://user:pass@host:5432/db" to
// "Host=host;Port=5432;Database=db;Username=user;Password=pass;..."
// This is needed because Npgsql doesn't accept URI format natively
```

---

### 8.2 Models

Models live in `artifacts/api-server/Models/`.

#### `Entities.cs` — Database entities (mapped to DB tables by EF Core)

| Class | Table | Key fields |
|-------|-------|-----------|
| `Employee` | `employees` | Id (UUID), EmployeeId (business code e.g. "EMP001"), Name, Email, Role (string), ManagerId (nullable FK to employees) |
| `Client` | `clients` | Id, ClientCode, Name, Status |
| `Project` | `projects` | Id, ProjectCode, Name, ClientId (FK), Status |
| `Activity` | `activities` | Id, Name, Status |
| `Timesheet` | `timesheets` | Id, EmployeeId (FK), WeekStartDate (string "YYYY-MM-DD"), Status, TotalHours |
| `TimesheetRow` | `timesheet_rows` | Id, TimesheetId (FK), ProjectId (FK), ActivityId (FK), Monday–Sunday (float hours), MondayStart–SundayEnd (optional time strings), TotalHours, Comments |
| `Notification` | `notifications` | Id, UserId, Type, Title, Message, IsRead, RelatedId |
| `AuditLog` | `audit_logs` | Id, UserId, UserName, Role, Action, EntityType, EntityId, OldValue, NewValue, IpAddress |

> **Important:** All enum-like fields (Role, Status) are stored as **PostgreSQL enum types** in the database but mapped as **plain strings** in C# models. This was done to avoid Npgsql enum registration complexity. The `::text` cast is used in SQL WHERE clauses and `::employee_role` etc. in INSERT/UPDATE statements.

#### `SessionUser.cs`
A lightweight object stored in the session. It holds just enough info about the logged-in user for auth checks and notifications — not the full Employee record.

```csharp
public class SessionUser {
    public string Id { get; set; }         // UUID — use this as employeeId in API calls
    public string EmployeeId { get; set; } // Business code like "EMP001" — for display only
    public string Name { get; set; }
    public string Email { get; set; }
    public string Role { get; set; }       // "Employee", "Manager", or "Admin"
    public string? ManagerId { get; set; } // UUID of the manager, if applicable
}
```

#### `Exceptions.cs`
Contains `InvalidTransitionException` — thrown by the repository when a timesheet status transition is blocked (e.g., approving an already-approved timesheet). The controller catches it and returns HTTP 409 Conflict.

---

### 8.3 Session & Authentication

The app uses **cookie-based server sessions** — no JWT tokens.

**How login works:**
1. Frontend calls `POST /api/auth/select-user` with `{ id: "some-uuid" }`
2. Backend loads the Employee from the database
3. Copies key fields into a `SessionUser` object
4. Serializes it to JSON and stores it in the session: `session.SetString("user", json)`
5. ASP.NET Core creates a session ID, stores the session data in PostgreSQL, and sends a `Set-Cookie` header back to the browser
6. Every subsequent request includes that cookie automatically

**`SessionExtensions.cs`** — Helper methods so controllers don't repeat JSON serialization:
```csharp
// Read the current user from session (returns null if not logged in)
var user = HttpContext.Session.GetUser();

// Write user to session (called on login)
HttpContext.Session.SetUser(sessionUser);
```

**`AuthFilters.cs`** — ASP.NET attribute-based auth:

```csharp
// Put [RequireAuth] on a controller method to require any logged-in user
[RequireAuth]
public IActionResult GetTimesheets() { ... }

// Put [RequireRole("Admin")] to require a specific role (returns 403 if wrong role)
[RequireRole("Manager", "Admin")]
public IActionResult ApproveTimesheet() { ... }
```

These are `IAuthorizationFilter` implementations — ASP.NET Core calls `OnAuthorization()` before the controller action runs. If the check fails, it short-circuits with a 401 or 403 and the controller method never executes.

---

### 8.4 Controllers Reference

All controllers are in `artifacts/api-server/Controllers/`. All routes are prefixed with `/api`.

#### `AuthController.cs` — `/api/auth/...`

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/auth/users` | None | Returns all Active employees. Used by the login page to show who you can log in as. |
| GET | `/auth/me` | None | Returns the `SessionUser` from the current session, or 401 if not logged in. Used by the frontend to restore state after a page refresh. |
| POST | `/auth/select-user` | None | Accepts `{ id }`, loads the employee, stores as session user, returns `SessionUser`. This is the "login" endpoint. |
| POST | `/auth/logout` | None | Calls `session.Clear()` to log out. Returns `{ ok: true }`. |

#### `TimesheetsController.cs` — `/api/timesheets/...`

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/timesheets` | Auth | Lists timesheets with pagination. **Role-scoped:** Employees only see their own (`employeeId = user.Id`); Managers only see their team's (`managerId = user.Id`); Admins see all. Returns `{ data, total, page, pageSize }`. |
| POST | `/timesheets` | Auth | Creates a new timesheet (or updates if one already exists for that week in Draft status). Validates the employee doesn't already have a non-Draft sheet for the same week. Creates an AuditLog entry. |
| GET | `/timesheets/{id}` | Auth | Returns one timesheet by ID with all its rows. Role-scoped: Employees can only fetch their own. |
| PATCH | `/timesheets/{id}` | Auth | Replaces all rows of an existing Draft or Rejected timesheet. Returns 400 if the timesheet is in any other status. |
| POST | `/timesheets/{id}/submit` | Auth | Changes status from Draft or Rejected → Submitted. Sends a notification to the employee's manager. Returns 409 if the status has changed since the page loaded (race-safe). |
| POST | `/timesheets/{id}/approve` | Manager/Admin | Changes status from Submitted → Approved. Sends a notification to the employee. Returns 409 on conflict. |
| POST | `/timesheets/{id}/reject` | Manager/Admin | Changes status from Submitted → Rejected. Requires a comment. Sends a notification to the employee. Returns 409 on conflict. |
| POST | `/timesheets/bulk-action` | Manager/Admin | Approves or rejects a list of timesheet IDs in one call. Returns `{ processed, succeeded, failed }`. |
| POST | `/timesheets/copy-previous-week` | Auth | Copies all rows (including start/end times) from `sourceWeekStartDate` to `targetWeekStartDate` for the given employee. Returns the newly created timesheet. |

> **Route ordering gotcha:** In `App.tsx` routing, `/timesheets/new` is declared **before** `/timesheets/:id` so the literal path "new" isn't accidentally matched as an ID. The same care is taken in the backend — `bulk-action` and `copy-previous-week` routes are registered before the `{timesheetId}` parameterized routes.

#### `EmployeesController.cs` — `/api/employees/...`

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/employees` | Auth | Paginated employee list. Supports `search`, `role`, `status`, `department` query params. |
| POST | `/employees` | Admin | Creates a new employee. Validates required fields (name, email, department, designation) and returns 400 with a descriptive error if missing. |
| GET | `/employees/bulk-upload-template` | Admin | Generates and downloads an Excel file with the correct column headers as a template. |
| POST | `/employees/bulk-upload` | Admin | Accepts a multipart form file (xlsx). Parses each row, validates, creates employees. Returns `{ created: [...], errors: [...] }`. |
| GET | `/employees/{id}/profile` | Auth | Returns `{ employee: {...}, metrics: { totalSubmitted, approved, rejected, pending, approvalRate } }`. Role-scoped. |
| GET | `/employees/{id}/direct-reports` | Manager/Admin | Returns the manager's direct reports with their timesheet stats. |
| PATCH | `/employees/{id}` | Admin | Updates any fields on an employee. Validates enum values (role, status). Creates an AuditLog. |
| DELETE | `/employees/{id}` | Admin | Soft-deletes (sets status to Inactive, does not remove the row). Creates an AuditLog. |

#### `ProjectsController.cs` — `/api/projects/...`

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/projects` | Auth | Paginated list. Supports `status`, `clientId`, `search` filters. |
| POST | `/projects` | Admin | Creates a project. Required: `name`, `projectCode`, `clientId`. Status must be "Active" or "Inactive". |
| GET | `/projects/{id}` | Auth | Returns one project including its client name. |
| PATCH | `/projects/{id}` | Admin | Updates project fields. |
| DELETE | `/projects/{id}` | Admin | Hard-deletes the project record. |

#### `ClientsController.cs` — `/api/clients/...`
Same shape as Projects. Required field for create: `name`. Supports search, pagination, CRUD.

#### `ActivitiesController.cs` — `/api/activities/...`
Simple CRUD for activity types. No pagination — returns full list (activity lists are typically short).

#### `DashboardController.cs` — `/api/dashboard/...`

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/dashboard/stats` | Manager/Admin | Returns `{ totalEmployees, pendingApprovals, timesheetsApproved, complianceRate }` — system-wide overview. |
| GET | `/dashboard/my-stats` | Auth | Returns personal stats for the logged-in user: their submission/approval counts, recent timesheets. |
| GET | `/dashboard/recent-activity` | Manager/Admin | Returns last N timesheet status changes with employee names and timestamps. |
| GET | `/dashboard/compliance-overview` | Manager/Admin | Returns per-department compliance breakdown. |

#### `SearchController.cs` — `/api/search?q=...`
Global search across employees, projects, clients, and timesheets. Results are role-scoped:
- Employee: only sees themselves + their own timesheets
- Manager: sees their team + active projects/clients + team timesheets
- Admin: sees everything

#### `ExportController.cs` — `/api/export/...`

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/export/timesheets` | Manager/Admin | Exports filtered timesheets as CSV or Excel (xlsx). Query params: `format` ("csv"/"xlsx"), plus the same filters as the timesheets list. |
| GET | `/export/audit-logs` | Admin | Exports the audit log in CSV or xlsx format. |

#### `NotificationsController.cs` — `/api/notifications/...`
Manages the user's notification inbox. Supports list (paginated, with `isRead` filter), mark-as-read, mark-all-read.

#### `AuditLogsController.cs` — `/api/audit-logs/...`
Admin-only. Lists audit log entries with filters (userId, action, entityType, date range). Read-only — logs are created internally, never via direct API call.

#### `HealthController.cs`
```
GET /api/health   → { status: "ok" }
GET /api/healthz  → { status: "ok" }
```
Used by infrastructure to check if the server is up. No auth required.

---

### 8.5 Repositories Reference

Repositories live in `artifacts/api-server/Repositories/`. **All database queries live here — controllers never query the database directly.** This separation makes the code easier to test and change.

Every repository implements an interface defined in `IRepositories.cs`. This means you can always look at the interface to see what methods a repository must have.

#### Why mixed EF Core + raw Npgsql?

EF Core is used for simple queries (find by ID, LINQ filtering). Raw `NpgsqlConnection` is used when:
1. The query involves PostgreSQL **enum types** — EF Core can't cast `status::text` in WHERE clauses cleanly
2. Atomic UPDATE with conditional WHERE is needed (status transitions)
3. Complex aggregations are simpler to write in raw SQL

#### `EmployeeRepository.cs`

| Method | What it does |
|--------|-------------|
| `FindAll(page, pageSize, search, role, status, department, managerId)` | Builds a dynamic SQL query — adds WHERE clauses only for the filters that are provided. Returns paginated results. |
| `FindById(id)` | EF Core lookup by UUID, then enriches with manager name via a second query. |
| `FindByEmail(email)` / `FindByEmployeeId(employeeId)` | EF Core lookup by those fields. |
| `Create(data)` | Raw Npgsql INSERT with `::employee_role` and `::employee_status` enum casts. |
| `Update(id, data)` | EF Core load → mutate fields in C# → raw Npgsql UPDATE with enum casts. |
| `Delete(id)` | Soft delete — raw SQL `UPDATE SET status='Inactive'`. |
| `BulkCreate(rows)` | Loops through rows, validates each (missing fields, duplicate email/employeeId), resolves manager ID from business code, calls `Create()` per row. Returns split success/error lists. |
| `GetProfile(id)` | Calls `FindById` for the employee, then raw Npgsql aggregate query for timesheet metrics. Returns `{ employee, metrics }`. |
| `GetDirectReports(managerId)` | Fetches all employees with `manager_id = managerId`, then for each one fetches their timesheet stats via raw SQL. Returns manager + team stats. |

#### `TimesheetRepository.cs`

| Method | What it does |
|--------|-------------|
| `FindAll(page, pageSize, employeeId, status, weekStartDate, managerId)` | Builds a dynamic SQL query. If `managerId` is set, JOINs employees table to filter by `e.manager_id`. Returns enriched timesheets. |
| `FindById(id)` | EF Core lookup → `EnrichTimesheet()`. |
| `FindByEmployeeAndWeek(employeeId, weekStartDate)` | EF Core lookup by composite key. |
| `Create(employeeId, weekStartDate, rows)` | Creates the timesheet header, then creates all rows, calculates `totalHours`. Returns the enriched result. |
| `Update(id, rows)` | Deletes all existing rows (`ExecuteDeleteAsync`), then creates new rows. Only works for Draft/Rejected timesheets. |
| `Submit(id)` | **Atomic** raw SQL `UPDATE timesheets SET status='Submitted' WHERE id=$1 AND status::text IN ('Draft','Rejected')`. If 0 rows affected, checks current status and throws `InvalidTransitionException` if wrong. |
| `Approve(id, approvedBy, comment)` | **Atomic** raw SQL `UPDATE ... WHERE status='Submitted'`. Same guard as Submit. |
| `Reject(id, comment)` | **Atomic** raw SQL `UPDATE ... WHERE status='Submitted'`. Same guard. |
| `BulkAction(ids, action, approvedBy, comment)` | Loops through IDs calling Approve or Reject. Counts successes/failures. |
| `CopyFromPreviousWeek(employeeId, sourceWeek, targetWeek)` | Loads the source week's timesheet, copies all rows including start/end times into a new timesheet for the target week. |
| `GetStatusBreakdown()` | Single aggregate SQL query: counts timesheets by status (Draft/Submitted/Approved/Rejected). |
| `GetComplianceOverview()` | Per-department SQL: counts employees vs. those who submitted in the last 4 weeks. |
| **`EnrichTimesheet(dict)`** *(private)* | Takes raw DB row data, loads the associated rows + employee name + approver name + project/activity names per row. Assembles the full nested response object. Called after every query that returns a timesheet. |
| **`BuildRow(rowId, timesheetId, row, total, now)`** *(private)* | Converts a `Dictionary<string, object?>` from the request body into a `TimesheetRow` entity, extracting all day fields safely. |
| **`CalcTotal(row)`** *(private)* | Sums monday+tuesday+...+sunday floats from the row dictionary to compute `totalHours`. |

#### `ProjectRepository.cs`

| Method | What it does |
|--------|-------------|
| `FindAll(page, pageSize, status, clientId, search)` | Dynamic SQL with JOINed client name. |
| `FindById(id)` | EF Core lookup + client name JOIN. |
| `Create(data)` | Raw Npgsql INSERT with `::project_status` cast. Validates status is only "Active" or "Inactive" (not "Completed"). |
| `Update(id, data)` | EF Core load + raw SQL UPDATE. Validates enum. |
| `Delete(id)` | EF Core hard delete. |

#### `ClientRepository.cs`
Simple CRUD. `Create` validates `name` is present. Uses raw Npgsql for INSERT (to handle `::client_status` cast), EF Core for lookups.

#### `ActivityRepository.cs`
Simple CRUD. Activities don't have status complexity.

#### `NotificationRepository.cs`

| Method | What it does |
|--------|-------------|
| `FindAll(userId, isRead, page, pageSize)` | Lists notifications for a specific user, optionally filtered by read status. |
| `Create(data)` | Creates a notification. Called internally by controllers after status transitions. |
| `MarkAsRead(id, userId)` | Sets `is_read = true`. Checks userId matches to prevent marking others' notifications. |
| `MarkAllRead(userId)` | Batch update — sets all of a user's notifications to read. |

#### `AuditRepository.cs`

| Method | What it does |
|--------|-------------|
| `Create(data)` | Inserts an audit log entry. Called by controllers after every create/update/delete/approve/reject. |
| `FindAll(...)` | Lists audit logs with optional filters (userId, entityType, action, date range, pagination). |

---

### 8.6 Helpers

#### `IdGenerator.cs`
```csharp
public static string NewId() => Guid.NewGuid().ToString();
```
Every new entity gets a UUID generated here. Simple wrapper so if you ever want to switch ID generation strategy (e.g., to ULID or Snowflake IDs), you change one file.

#### `SessionExtensions.cs`
Extension methods on `ISession` to serialize/deserialize the `SessionUser` object:
- `session.GetUser()` — reads the "user" key, deserializes from JSON, returns null if missing
- `session.SetUser(user)` — serializes to JSON, writes to "user" key

#### `ClientIpHelper.cs`
```csharp
ClientIpHelper.GetClientIp(Request)
```
Reads the real client IP from the request, checking `X-Forwarded-For` and `X-Real-IP` headers first (set by Replit's proxy), falling back to `RemoteIpAddress`. Used when creating audit log entries.

---

## 9. Database

The database schema is managed by **Drizzle ORM** — a Node.js tool. The schema definition files live in the `drizzle/` folder.

### Key tables

```
employees          — staff directory
timesheets         — one row per employee per week
timesheet_rows     — one row per project/activity per day within a timesheet
projects           — work projects (belong to a client)
clients            — client companies
activities         — work activity types
notifications      — user inbox items
audit_logs         — immutable system event trail
aspnet_session_cache — ASP.NET session storage (auto-managed)
```

### Enum types in PostgreSQL
The database uses native PostgreSQL enum types:
- `employee_role`: `'Employee'`, `'Manager'`, `'Admin'`
- `employee_status`: `'Active'`, `'Inactive'`
- `timesheet_status`: `'Draft'`, `'Submitted'`, `'Approved'`, `'Rejected'`
- `project_status`: `'Active'`, `'Inactive'`

**In C# code:** These are mapped as `string` properties, not C# enums. When writing SQL, you must cast explicitly:
```sql
-- Reading (cast to text for comparison):
WHERE status::text = 'Approved'

-- Writing (cast to the enum type):
INSERT INTO timesheets (..., status, ...) VALUES (..., 'Draft'::timesheet_status, ...)
```

### Pagination shape
Every list endpoint returns this structure:
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```
Always use `.data` to access the array — not `.items` or the root response directly.

---

## 10. Key Patterns to Understand

### Pattern 1: Role-scoped data on the backend

The backend enforces data access by role. Controllers read `user.Role` from the session and add appropriate filters before calling the repository:

```csharp
// Example from TimesheetsController.GetTimesheets()
if (user.Role == "Employee") employeeId = user.Id;       // Employees only see their own
if (user.Role == "Manager")  managerId = user.Id;        // Managers only see their team
// Admin passes through — no filter added
var result = await _timesheetRepo.FindAll(page, pageSize, employeeId, status, weekStartDate, managerId);
```

**Never rely only on frontend role checks** — they're for UX only (hiding menu items). The backend always re-checks.

### Pattern 2: Atomic status transitions

Timesheet status changes use raw SQL with a conditional WHERE to prevent race conditions:

```sql
UPDATE timesheets
SET status = 'Approved'::timesheet_status, approved_at = now(), approved_by = $2
WHERE id = $1 AND status::text = 'Submitted'
```

If `rows affected == 0`, the repository checks whether the record doesn't exist (→ 404) or was in the wrong status (→ `InvalidTransitionException` → 409 Conflict). This means two managers clicking "Approve" simultaneously will not double-approve.

### Pattern 3: Audit logging on every mutation

Every controller that creates, updates, or deletes data calls `_auditRepo.Create(...)` after the operation:

```csharp
await _auditRepo.Create(new Dictionary<string, object?> {
    ["userId"]     = user.Id,
    ["userName"]   = user.Name,
    ["role"]       = user.Role,
    ["action"]     = "Employee Updated",
    ["entityType"] = "Employee",
    ["entityId"]   = employeeId,
    ["oldValue"]   = JsonSerializer.Serialize(oldEmployee),
    ["newValue"]   = JsonSerializer.Serialize(body),
    ["ipAddress"]  = ClientIpHelper.GetClientIp(Request),
});
```

### Pattern 4: Notifications on status transitions

When a timesheet is submitted, approved, or rejected, a `Notification` is created for the relevant user. This happens in the controller:

```csharp
// After submit → notify the manager
await _notificationRepo.Create(new Dictionary<string, object?> {
    ["userId"]    = user.ManagerId,
    ["type"]      = "TIMESHEET_SUBMITTED",
    ["title"]     = "Timesheet Awaiting Approval",
    ["message"]   = $"{user.Name} submitted a timesheet...",
    ["relatedId"] = timesheetId,
    ["isRead"]    = false,
});
```

### Pattern 5: Required field validation → 400 not 500

Create endpoints validate required fields before touching the database:

```csharp
if (string.IsNullOrWhiteSpace(body.GetValueOrDefault("name")?.ToString()))
    return BadRequest(new { error = "name is required" });
```

This ensures missing fields return HTTP 400 with a clear message, not a cryptic database constraint error as HTTP 500.

---

## 11. End-to-End Feature Walkthrough

Here is the complete journey of a timesheet from creation to approval:

```
1. EMPLOYEE creates timesheet
   Frontend: TimesheetNew page → useCreateTimesheet()
   HTTP:     POST /api/timesheets
   Backend:  TimesheetsController.CreateTimesheet()
             → TimesheetRepository.Create()
             → AuditRepository.Create("Timesheet Created")
   DB:       INSERT INTO timesheets (status='Draft')
             INSERT INTO timesheet_rows (...)

2. EMPLOYEE submits timesheet
   Frontend: TimesheetDetail page → "Submit" button → useSubmitTimesheet(id)
   HTTP:     POST /api/timesheets/{id}/submit
   Backend:  TimesheetsController.Submit()
             → Controller checks status == "Draft" or "Rejected"
             → TimesheetRepository.Submit(id)  [atomic SQL]
             → NotificationRepository.Create() [notify manager]
             → AuditRepository.Create("Timesheet Submitted")
   DB:       UPDATE timesheets SET status='Submitted' WHERE id=? AND status IN ('Draft','Rejected')

3. MANAGER approves timesheet
   Frontend: Approvals page → approve button → useApproveTimesheet(id)
   HTTP:     POST /api/timesheets/{id}/approve
   Backend:  TimesheetsController.Approve()
             → Controller checks status == "Submitted"
             → TimesheetRepository.Approve(id, approverId)  [atomic SQL]
             → NotificationRepository.Create() [notify employee]
             → AuditRepository.Create("Timesheet Approved")
   DB:       UPDATE timesheets SET status='Approved', approved_by=?, approved_at=now()
             WHERE id=? AND status='Submitted'

4. EMPLOYEE sees notification
   Frontend: AppLayout notification bell badge updates (React Query refetch)
             Notifications page shows "Your timesheet was approved"
```

---

## 12. How to Add a New Feature

### Adding a new API endpoint (backend)

1. **Add method to the interface** in `Repositories/IRepositories.cs`
2. **Implement the method** in the corresponding repository file (e.g. `TimesheetRepository.cs`)
3. **Add the controller action** in the relevant controller:
   ```csharp
   [HttpGet("timesheets/{id}/something")]
   [RequireAuth]
   public async Task<IActionResult> SomethingNew(string id)
   {
       try {
           var user = HttpContext.Session.GetUser()!;
           var result = await _timesheetRepo.SomethingNew(id);
           if (result == null) return NotFound(new { error = "Not found" });
           return Ok(result);
       }
       catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
   }
   ```
4. **Test with curl** or Postman before wiring up the frontend

### Adding a new page (frontend)

1. **Create the page file** in `src/pages/my-new-page.tsx`
2. **Register the route** in `src/App.tsx`:
   ```tsx
   import MyNewPage from "@/pages/my-new-page";
   // Inside the Router's <Switch>:
   <Route path="/my-new-page" component={MyNewPage} />
   ```
3. **Add to the sidebar** in `src/components/layout/app-layout.tsx` (if it should appear in navigation)
4. **Use the API hook** in your page to fetch data

### Adding a new database table

1. **Add the schema** in `drizzle/schema.ts` (Drizzle ORM format)
2. **Push the schema** to the database: `pnpm drizzle-kit push`
3. **Add the EF Core entity** in `Models/Entities.cs`
4. **Register it** in `Data/AppDbContext.cs` as a `DbSet<YourEntity>`
5. **Create the repository** implementing the interface pattern

---

## 13. Common Mistakes to Avoid

| Mistake | Why it's wrong | What to do instead |
|---------|---------------|-------------------|
| Using `employee.employeeId` as the database FK | `employeeId` is the business code ("EMP001"), not the UUID | Use `employee.id` (UUID) for all foreign keys and session lookups |
| Accessing `.items` on a list response | List endpoints return `{ data, total, page, pageSize }` | Always use `.data` to access the array |
| Checking roles only on the frontend | A user could call the API directly | Always add `[RequireAuth]` or `[RequireRole]` to protected controller actions |
| Using `AddDistributedMemoryCache()` for sessions | Sessions are lost on server restart and won't scale | The project uses PostgreSQL-backed sessions — keep it that way |
| Sending `status: "Completed"` for a project | The `project_status` DB enum only has `Active` and `Inactive` | Only send `"Active"` or `"Inactive"` |
| Writing database queries in controllers | Mixes concerns, hard to test | All DB logic goes in repositories |
| Using `return res.xxx()` pattern (Express habit) | This is C# not Node — void returns are used | Use `return Ok(...)`, `return NotFound(...)`, `return StatusCode(...)` |
| Using `day: "monday"` (lowercase string) in timesheet rows | The field names are the column names | Use the exact property name: `Monday`, `Tuesday`, etc. |
| Hard-coding localhost API URLs in the frontend | Breaks in production and Replit proxy environment | Use the base URL from `import.meta.env.BASE_URL` — the API client does this automatically |
