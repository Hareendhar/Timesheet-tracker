const express = require("express");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { store } = require("../data/store");
const employeeRepo = require("../repositories/employees");
const { asyncHandler } = require("../lib/auth");

const router = express.Router();

const isDevModeEnabled = () => process.env.AUTH_DEV_MODE === "true";

function requireDevMode(req, res, next) {
  if (!isDevModeEnabled()) return res.status(404).json({ error: "Not found" });
  next();
}

function getAllowedDomains() {
  return (process.env.GOOGLE_WORKSPACE_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

// Google redirects back to the API server itself (a different origin/port
// than the frontend in local dev), so post-callback redirects must be
// absolute URLs pointing at the frontend — a relative "/" would resolve
// against this server's own origin, which has no such route.
function frontendUrl(path) {
  const base = (process.env.FRONTEND_URL || "http://localhost:19667").replace(/\/+$/, "");
  return `${base}${path}`;
}

function getOAuthClient() {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  });
}

function sessionUserFromEmployee(employee) {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    designation: employee.designation,
    managerId: employee.managerId ?? null,
  };
}

router.get(
  "/users",
  requireDevMode,
  asyncHandler(async (req, res) => {
    const rows = store.employees
      .filter((e) => e.status === "Active")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        name: e.name,
        email: e.email,
        department: e.department,
        designation: e.designation,
        role: e.role,
        managerId: e.managerId ?? null,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    res.json(rows);
  }),
);

router.get("/me", (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json(user);
});

router.post(
  "/select-user",
  requireDevMode,
  asyncHandler(async (req, res) => {
    const employee = store.employees.find((e) => e.id === req.body.id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    req.session.user = sessionUserFromEmployee(employee);
    res.json(req.session.user);
  }),
);

// Step 1: redirect the browser to Google's consent screen.
router.get("/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const allowedDomains = getAllowedDomains();
  const client = getOAuthClient();
  const authUrl = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
    // `hd` only accepts a single domain as a UI hint — with more than one
    // allowed domain we omit it and rely on the callback's allow-list check.
    ...(allowedDomains.length === 1 ? { hd: allowedDomains[0] } : {}),
  });

  res.redirect(authUrl);
});

// Step 2: Google redirects back here with a code (or an error).
router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) return res.redirect(frontendUrl("/login?error=access_denied"));
    if (!state || state !== req.session.oauthState) return res.redirect(frontendUrl("/login?error=invalid_state"));
    delete req.session.oauthState;

    const client = getOAuthClient();
    let payload;
    try {
      const { tokens } = await client.getToken(code);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.redirect(frontendUrl("/login?error=oauth_failed"));
    }

    if (!payload?.email || !payload.email_verified) return res.redirect(frontendUrl("/login?error=oauth_failed"));

    const allowedDomains = getAllowedDomains();
    if (allowedDomains.length > 0 && !allowedDomains.includes(payload.hd?.toLowerCase()))
      return res.redirect(frontendUrl("/login?error=domain_not_allowed"));

    const employee = await employeeRepo.findByEmail(payload.email);
    if (!employee || employee.status !== "Active") return res.redirect(frontendUrl("/login?error=not_authorized"));

    req.session.user = sessionUserFromEmployee(employee);
    res.redirect(frontendUrl("/"));
  }),
);

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

module.exports = router;
