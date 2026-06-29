# Rewrite backend to PHP + MySQL and deploy to cPanel

> **Status: deferred.** This was planned in full but the decision was made to NOT pursue it for
> now. Kept here for reference if/when cPanel deployment of this app is revisited.

## Context

The app is currently a Node.js/Express backend (in-memory JSON data store) + React frontend, built for fast local testing. Now it needs to go live on the company's actual hosting: cPanel shared hosting with **no Node.js App Manager** (confirmed absent from the Software section) but full native **PHP + MySQL** support (phpMyAdmin, MySQL Database Wizard, MultiPHP Manager all present).

Given that, this is a third backend rewrite (C# → Node.js → PHP), but it's the right call: PHP+MySQL is what this hosting actually runs natively. Doing it this way means the domain, the static React frontend, the PHP API, and the MySQL database all live on **one cPanel account, one origin** — no CORS, no cross-site cookies, no external service account, no remote-database security surface. The alternative (host the Node backend on an external platform like Render and call it cross-origin) was considered and explicitly rejected in favor of this.

Constraints that shape every decision below (all confirmed):
- **No confirmed Composer/SSH** → zero external PHP dependencies. Only PHP's bundled extensions: PDO (MySQL), curl/openssl (HTTP + crypto for Google OAuth), native sessions, `fputcsv`/`fgetcsv`.
- **Excel (.xlsx) → CSV.** Bulk-upload and all exports lose styled `.xlsx` output and become plain CSV — same data, no library needed. Confirmed acceptable.
- **Manual deploy.** No git-on-server, no CI. Build the frontend locally, upload via cPanel File Manager.
- **Target subdomain**: `timesheets.versatileitsol.com`.

The Node implementation at `artifacts/api-server/` is the ground-truth business logic to port — it was itself a faithful port of the original C# version, plus several bug fixes made since (manager-viewing-own-timesheet fix, multi-status filter for the Approvals History tab, the Google OAuth flow). **Every route file and repository file under `artifacts/api-server/src/` must be read directly during implementation**, not re-derived from memory — this plan names the files but the line-by-line behavior (filtering, status-transition rules, role-scoping, enrichment joins) must be copied faithfully from that source.

Two corrections to keep in mind versus the README (which describes the original C# version and is stale on these two points): roles are `Employee` / `Manager` / `HR` (not "Admin"), and timesheets have a 5th status, `ClientSubmitted` (used by `clientSubmissions.js`, the client-billing-submission feature), in addition to Draft/Submitted/Approved/Rejected.

## Phase A — MySQL schema

Create via phpMyAdmin or a `schema.sql` run through the migration script (Phase D). Eight tables, mirroring the JS entities field-for-field (camelCase → snake_case):

`employees`, `clients`, `projects`, `activities`, `timesheets`, `timesheet_rows`, `notifications`, `audit_logs`.

Key decisions:
- **Status/role columns**: `VARCHAR` + `CHECK` constraint, not MySQL `ENUM` — matches the Node version's deliberate string-typing (avoids `ALTER TABLE` friction; enums are exactly what the original C#/Postgres version moved away from already, per the README's "all enum-like fields mapped as plain strings" note).
- **Foreign keys**: `employees.manager_id → employees.id`, `projects.client_id → clients.id`, `timesheets.employee_id/approved_by → employees.id`, `timesheet_rows.timesheet_id/project_id/activity_id`, `notifications.user_id → employees.id`. `audit_logs.user_id`/`entity_id` stay as loose VARCHAR (no FK) — audit rows must survive even if a referenced row changes, and `clientSubmissions.js` stores comma-joined ID lists in `entity_id`.
- **New constraint not present in the Node version**: `UNIQUE (employee_id, week_start_date)` on `timesheets` — closes a race-condition gap the in-memory array never had to worry about; safe because the app logic already only ever creates one row per employee/week.
- **No sessions table** — PHP's native file-based sessions are sufficient for single-server shared hosting (the Node baseline itself runs unconfigured in-memory sessions, so this is a durability upgrade, not a downgrade).
- IDs stay as `CHAR(36)` UUID strings (matching `src/lib/id.js`'s `crypto.randomUUID()` — PHP needs an equivalent `uuidv4()` helper).

## Phase B — PHP backend, mirroring the Express structure

New `api/` folder (deployed under the subdomain's document root, alongside the built frontend):

```
api/
├── index.php                 # front controller — every /api/* request lands here
├── config.php                # gitignored: DB creds, Google OAuth secrets, AUTH_DEV_MODE
├── config.example.php        # committed template
├── lib/
│   ├── Database.php          # PDO connection
│   ├── Auth.php              # requireAuth()/requireRole(...) — same checks as src/lib/auth.js
│   ├── Id.php                # uuidv4()
│   ├── ClientIp.php
│   ├── Exceptions.php        # InvalidTransitionException → HTTP 409
│   ├── Response.php          # json()/error() helpers
│   ├── Router.php            # hand-rolled regex router, :param syntax
│   ├── GoogleOAuth.php       # authUrl() / exchangeCode() / verifyIdToken()
│   └── Csv.php
├── repositories/              # one per entity, ported from src/repositories/*.js
│   ├── EmployeeRepository.php / ClientRepository.php / ProjectRepository.php
│   ├── ActivityRepository.php / TimesheetRepository.php / NotificationRepository.php
│   └── AuditRepository.php
├── routes/                    # one per src/routes/*.js file (13 total)
│   ├── auth.php / employees.php / clients.php / projects.php / activities.php
│   ├── timesheets.php / notifications.php / auditLogs.php / dashboard.php
│   ├── search.php / clientSubmissions.php / export.php / health.php
└── scripts/
    ├── migrate.php            # one-time: create schema + load seed data into MySQL
    ├── schema.sql
    └── seed/*.json             # copied from artifacts/api-server/src/seed/ at packaging time
```

**Routing**: a small hand-rolled router (`Router.php`) supporting `:param` path segments, dispatching by exact method+pattern match in registration order — mirrors Express's order-sensitive matching. Routes with literal prefixes (`/timesheets/bulk-action`, `/timesheets/copy-previous-week`) **must be registered before** the parameterized `/timesheets/:timesheetId`, exactly as the existing code already does and comments on (see `timesheets.js`) — get this ordering wrong and `bulk-action` gets swallowed as a `:timesheetId` value.

**Auth**: PHP native sessions (`$_SESSION['user']`), same `SessionUser` shape as `sessionUserFromEmployee()` in `auth.js`. `requireAuth()`/`requireRole(...$roles)` called explicitly at the top of each handler (no middleware chain without a framework — functionally identical, just invoked inline). Dev "pick any employee" picker stays, gated by `AUTH_DEV_MODE` from `config.php`, returning 404 (not 403) when disabled — same as today.

**Google OAuth — the one real design choice**: verify the ID token manually via Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`) + `openssl_verify` (RS256), *not* the `tokeninfo` endpoint (which Google's own docs mark as debugging-only, not for production reliance). This needs zero Composer packages — only `curl`/`openssl`/`json_decode`, all bundled. Recipe: fetch JWKS → match `kid` from the token header → convert the JWK's `n`/`e` to a PEM public key (DER/ASN.1 encoding, ~25 lines, pure string manipulation) → `openssl_verify` the signature → manually check `exp`/`aud`/`iss`/`email_verified` claims, same checks `google-auth-library` does internally today.

Because the PHP API and the React static build now share one origin, the `FRONTEND_URL`-driven absolute-redirect logic in the current `auth.js` (added recently because Google redirects back to a different port than the dev frontend) **becomes unnecessary** — relative `header('Location: /')` / `header('Location: /login?error=...')` is correct here. Likewise `CORS_ORIGIN` and the whole CORS middleware concept drop out entirely.

**CSV-only import/export**: `employees/bulk-upload-template` and `employees/bulk-upload` switch from ExcelJS workbooks to `fputcsv`/`fgetcsv` — same column set (`employeeId, name, email, department, designation, role, status, managerId`), same validation/dedup/manager-resolution logic ported from `EmployeeRepository::bulkCreate`. All `export/*` endpoints (employees, timesheets, clients, projects, audit-logs — exact column lists in the current `export.js`) drop the xlsx branch and always emit CSV. `clientSubmissions.js`'s `/download` endpoint keeps its 25-column detail row data but loses the styled header/frozen-pane formatting (no CSV equivalent — accepted simplification).

## Phase C — Migration/seed script

`api/scripts/migrate.php`: connects via PDO, runs `schema.sql`, then loads each of the 8 JSON seed files (a packaged copy of `artifacts/api-server/src/seed/*.json`, including the real `@versatileitsol.com` employee data already entered) via prepared statements. Insert order: `clients` → `projects` → `activities` → `employees` (two-pass: insert with `manager_id` null, then `UPDATE` to set it — sidesteps any FK-ordering assumption about array order) → `timesheets` → `timesheet_rows` → `notifications` → `audit_logs`. Idempotency guard: abort if `employees` already has rows, so it can't be run twice by accident.

Run it once via cPanel's Terminal (Advanced section) if available, otherwise as a token-gated one-time web request (`?token=<secret from config.php>`) since CLI access can't be assumed guaranteed.

## Phase D — cPanel + deployment steps, in order

1. **Subdomain**: cPanel → Domains → create `timesheets.versatileitsol.com`, document root as its own folder.
2. **MySQL database**: Databases → MySQL Database Wizard → create a database + a dedicated user scoped only to it. Note the generated `dbname`/`username`/password for `config.php`.
3. **Build the frontend locally**: `pnpm --filter @workspace/timesheet-portal run build` with `BASE_PATH=/` (required by `vite.config.ts`) → produces `artifacts/timesheet-portal/dist/public/*`.
4. **Assemble the deploy bundle locally**: built frontend files at the root + the full `api/` PHP tree + a hand-written `.htaccess` (below) — zip it for a single upload.
5. **Upload via File Manager**: extract the zip into the subdomain's document root.
6. **Create `api/config.php` directly on the server** (File Manager's text editor) — never put real secrets in the zip itself. Fill in DB credentials, `GOOGLE_CLIENT_ID`/`SECRET`, `GOOGLE_REDIRECT_URI=https://timesheets.versatileitsol.com/api/auth/google/callback`, `GOOGLE_WORKSPACE_DOMAINS=versatileitsol.com`, `AUTH_DEV_MODE=false` (or `true` temporarily for first smoke-testing).
7. **Run the migration** (Phase C).
8. **SSL**: cPanel → Security → SSL/TLS Certificates → AutoSSL for the new subdomain (usually automatic within minutes of subdomain creation).
9. **Update Google Cloud Console**: change the OAuth client's authorized redirect URI from `http://localhost:8080/api/auth/google/callback` to the production HTTPS URL from step 6.
10. **`.htaccess`** at the document root, handling both concerns (API rewrite evaluated first, then SPA fallback):
    ```apache
    RewriteEngine On
    RewriteCond %{REQUEST_URI} ^/api/
    RewriteRule ^api/(.*)$ api/index.php/$1 [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} !^/api/
    RewriteRule ^ index.html [L]
    ```
    The SPA fallback is required because client-side routes like `/timesheets/:id` have no real file on disk — without it, refreshing on a deep link 404s.

## Verification

1. `https://timesheets.versatileitsol.com/api/health` → `{"status":"ok"}`.
2. Load the root URL → login page renders (built static frontend serving correctly).
3. Sign in with Google using a real `@versatileitsol.com` account that exists in the migrated employee data → lands authenticated on the dashboard.
4. Directly load a deep link (e.g. `/timesheets/some-id`) by typing the URL — confirms the `.htaccess` SPA fallback, not just client-side navigation.
5. Create → submit → approve a timesheet end-to-end (same flow already verified in the Node version) to confirm the MySQL-backed repositories preserve the same behavior, including the manager-self-timesheet-visibility fix and the role-scoped Approvals list.
6. Export employees/timesheets/clients/projects/audit-logs → confirm valid CSV downloads with the right columns.
7. Bulk-upload a CSV of new employees → confirm validation errors and successes match expectations.
8. Confirm `AUTH_DEV_MODE=false` makes the dev employee-picker 404 before considering this production-ready.
