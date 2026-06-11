---
name: DB Seed Users
description: Demo employees seeded in the database for testing
---

## Seeded Employees
| Employee ID | Name | Email | Role |
|-------------|------|-------|------|
| EMP001 | Alice Johnson | alice@versatileit.com | Admin |
| EMP002 | Bob Williams | bob@versatileit.com | Manager |
| EMP003 | Carol Smith | carol@versatileit.com | Employee |
| EMP004 | David Lee | david@versatileit.com | Employee |
| EMP005 | Emma Davis | emma@versatileit.com | Employee |

To test login, the Google account's email must match one of these.
The seed script can be re-run: `npx tsx artifacts/api-server/src/lib/seed.ts`
(It clears and re-seeds all data including timesheets, clients, projects.)

## Seeded Reference Data
- Clients: Acme Corporation (CLI001), TechGlobal Inc. (CLI002)
- Projects: Mobile Banking App, ERP Integration, Cloud Migration
- Activities: Development, Testing, Support, Meeting, Training, Documentation, Recruitment, Leave
