require("dotenv").config();
// import "dotenv/config";

const express = require("express");
const cors = require("cors");
const session = require("express-session");

// import express from "express";
// import cors from "cors";
// import session from "express-session";

const authRoutes = require("./routes/auth");
const employeesRoutes = require("./routes/employees");
const clientsRoutes = require("./routes/clients");
const projectsRoutes = require("./routes/projects");
const activitiesRoutes = require("./routes/activities");
const timesheetsRoutes = require("./routes/timesheets");
const notificationsRoutes = require("./routes/notifications");
const auditLogsRoutes = require("./routes/auditLogs");
const dashboardRoutes = require("./routes/dashboard");
const searchRoutes = require("./routes/search");
const clientSubmissionsRoutes = require("./routes/clientSubmissions");
const exportRoutes = require("./routes/export");
const healthRoutes = require("./routes/health");
const { InvalidTransitionException } = require("./lib/exceptions");

const app = express();
app.use(express.json());

// CORS: explicit origins via env var take precedence; otherwise allow
// localhost and known Replit proxy domains so the React dev server can reach the API.
const explicitOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (explicitOrigins.length > 0) return callback(null, explicitOrigins.includes(origin));
      try {
        const host = new URL(origin).hostname;
        const allowed =
          host === "localhost" ||
          host.endsWith(".replit.dev") ||
          host.endsWith(".repl.co") ||
          host.endsWith(".replit.app") ||
          host.endsWith(".kirk.replit.dev");
        callback(null, allowed);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "local-dev-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api", employeesRoutes);
app.use("/api", clientsRoutes);
app.use("/api", projectsRoutes);
app.use("/api", activitiesRoutes);
app.use("/api", timesheetsRoutes);
app.use("/api", notificationsRoutes);
app.use("/api", auditLogsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", searchRoutes);
app.use("/api/client-submissions", clientSubmissionsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api", healthRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  if (err instanceof InvalidTransitionException) return res.status(409).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

const port = process.env.PORT || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`API server listening on http://0.0.0.0:${port}`);
});
