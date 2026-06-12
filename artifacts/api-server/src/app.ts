import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

const PgStore = connectPgSimple(session);

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

const getAllowedOrigins = (): string[] => {
  if (process.env.CORS_ALLOWED_ORIGINS) {
    return process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  }
  if (process.env.APP_URL) return [process.env.APP_URL];
  return [];
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin or server-to-server requests have no Origin header — allow
      if (!origin) return callback(null, true);
      // In development allow all origins for ease of local work
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      // In production restrict to the explicit allowlist
      const allowed = getAllowedOrigins();
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set in production");
}

// Ensure the session table exists (connect-pg-simple's built-in createTableIfMissing
// reads a SQL file at runtime which isn't available after esbuild bundling).
pool.query(`
  CREATE TABLE IF NOT EXISTS "session" (
    "sid"    varchar      NOT NULL COLLATE "default",
    "sess"   json         NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
  ) WITH (OIDS=FALSE);
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`).catch((err: any) => logger.error({ err }, "Failed to ensure session table"));

app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET || "dev-only-insecure-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  })
);

app.use("/api", router);

export default app;
