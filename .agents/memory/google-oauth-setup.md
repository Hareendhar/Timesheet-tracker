---
name: Google OAuth Setup
description: How Google OAuth is implemented and what secrets are needed
---

## Implementation
Custom OAuth (no passport library). Flow in `artifacts/api-server/src/routes/auth.ts`:
1. `/api/auth/google` → redirect to Google with client_id, redirect_uri, scope
2. `/api/auth/google/callback` → exchange code for tokens, fetch userinfo from Google, look up employee by email
3. If employee found and Active → set session user, redirect to `/`
4. If not found or Inactive → redirect to `/?error=not_configured`

## Required Secrets
- `GOOGLE_CLIENT_ID` — from Google Cloud Console OAuth 2.0 credentials
- `GOOGLE_CLIENT_SECRET` — same
- `GOOGLE_REDIRECT_URI` — optional, defaults to `${APP_URL}/api/auth/google/callback`
- `SESSION_SECRET` — optional, has hardcoded fallback (should set in production)

**Why:** Only employees whose emails are registered in the DB can sign in. Admins must add the employee record first.

## Google Cloud Setup
- Enable Google OAuth API in Google Cloud Console
- Add authorized redirect URI: `https://<domain>/api/auth/google/callback`
- For Replit dev: `https://<repl-domain>/api/auth/google/callback`
