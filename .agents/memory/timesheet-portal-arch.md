---
name: Timesheet Portal Architecture
description: Full-stack architecture decisions for the Versatile Timesheet Portal
---

## Stack
- Frontend: React + Vite + shadcn/Tailwind at artifact `timesheet-portal` (previewPath `/`)
- Backend: Express + Drizzle ORM at artifact `api-server` (port 8080, all routes under `/api`)
- DB: PostgreSQL via `@workspace/db` (pool + db exported from `lib/db/src/index.ts`)
- Auth: Custom Google OAuth (no passport) — session-based via `express-session` + `connect-pg-simple`
- Routing: Wouter in frontend with `base={import.meta.env.BASE_URL.replace(/\/$/, "")}`

## Repository Pattern
Interfaces in `artifacts/api-server/src/repositories/interfaces.ts`
Postgres implementations in `artifacts/api-server/src/repositories/postgres/`
All instantiated in `artifacts/api-server/src/repositories/index.ts`

**Why:** Clean separation allows swapping DB later; also keeps route handlers thin.

## Brand Colors (HSL equivalents)
- Dark Navy #1F2B5B → `228 49% 24%` (sidebar, headings)
- Medium Blue #1C75BC → `206 74% 42%` (primary buttons, links)
- Light Blue #29ABE2 → `198 76% 52%` (accents, badges)

Set in `artifacts/timesheet-portal/src/index.css` for both light and dark modes.

## Auth Flow
- `GET /api/auth/google` → redirect to Google
- `GET /api/auth/google/callback` → exchange code, fetch userinfo, look up by email in employees table
- Session stored in `sessions` table via connect-pg-simple
- Frontend: `useGetCurrentUser` with `retry: false` in AppLayout; redirect to /login via `useEffect` on 401

**Why:** retry:false is important — with retry:1 the loading spinner persists while retrying the 401.
