import { Router } from "express";
import { employeeRepo } from "../repositories/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Google OAuth - redirect (generates CSRF state)
router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/auth/google/callback`;
  const scope = "openid email profile";
  const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  (req.session as any).oauthState = state;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=select_account&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

// Google OAuth callback
router.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) { res.redirect("/login?error=no_code"); return; }
    // Validate CSRF state
    const expectedState = (req.session as any).oauthState;
    if (!state || !expectedState || state !== expectedState) { res.redirect("/login?error=invalid_state"); return; }
    delete (req.session as any).oauthState;

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: code as string, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokens.access_token) { res.redirect("/login?error=token_exchange_failed"); return; }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json() as any;
    const email = googleUser.email;

    // Look up employee
    const employee = await employeeRepo.findByEmail(email);
    if (!employee || employee.status === "Inactive") {
      res.redirect("/login?error=not_configured"); return;
    }

    (req.session as any).user = {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      designation: employee.designation,
      managerId: employee.managerId,
      avatarUrl: googleUser.picture ?? null,
    };

    res.redirect("/");
  } catch (err) {
    res.redirect("/login?error=auth_error");
  }
});

// Get current user
router.get("/auth/me", requireAuth, (req, res) => {
  res.json((req.session as any).user);
});

// Logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
