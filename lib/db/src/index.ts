import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Temporary debug log
const dbUrl = process.env.DATABASE_URL;

console.log(
  "DATABASE_URL:",
  dbUrl?.replace(/:(.*?)@/, ":****@")
);

export const pool = new Pool({
  connectionString: dbUrl,
});

export const db = drizzle(pool, { schema });

export * from "./schema";















// import { drizzle } from "drizzle-orm/node-postgres";
// import pg from "pg";
// import * as schema from "./schema";

// const { Pool } = pg;

// if (!process.env.DATABASE_URL) {
//   throw new Error(
//     "DATABASE_URL must be set. Did you forget to provision a database?",
//   );
// } 

// export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// export const db = drizzle(pool, { schema });

// export * from "./schema";
