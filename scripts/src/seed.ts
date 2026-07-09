import { db } from "@workspace/db";
import {
  activitiesTable,
  clientsTable,
  employeesTable,
  projectsTable,
  timesheetsTable,
  timesheetRowsTable,
} from "@workspace/db";

import { readFile } from "node:fs/promises";
import path from "node:path";

const seedDir = path.resolve(
  process.cwd(),
  "../artifacts/api-server/src/seed",
);

async function loadJson<T>(file: string): Promise<T> {
  const text = await readFile(path.join(seedDir, file), "utf8");
  return JSON.parse(text);
}


function convertDates<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => {
    const copy = { ...row };

    for (const key of Object.keys(copy)) {
      if (
        key.toLowerCase().includes("createdat") ||
        key.toLowerCase().includes("updatedat") ||
        key.toLowerCase().includes("submittedat") ||
        key.toLowerCase().includes("approvedat")
      ) {
        if (copy[key]) {
          copy[key] = new Date(copy[key]);
        }
      }
    }

    return copy;
  });
}


async function main() {
  console.log("🌱 Loading seed files...");

const employees = convertDates(await loadJson<any[]>("employees.json"));
const clients = convertDates(await loadJson<any[]>("clients.json"));
const activities = convertDates(await loadJson<any[]>("activities.json"));
const projects = convertDates(await loadJson<any[]>("projects.json"));
const timesheets = convertDates(await loadJson<any[]>("timesheets.json"));
const rows = convertDates(await loadJson<any[]>("timesheetRows.json"));

  console.log("Seeding employees...");
  await db.insert(employeesTable).values(employees).onConflictDoNothing();

  console.log("Seeding clients...");
  await db.insert(clientsTable).values(clients).onConflictDoNothing();

  console.log("Seeding activities...");
  await db.insert(activitiesTable).values(activities).onConflictDoNothing();

  console.log("Seeding projects...");
  await db.insert(projectsTable).values(projects).onConflictDoNothing();

  console.log("Seeding timesheets...");
  await db.insert(timesheetsTable).values(timesheets).onConflictDoNothing();

  console.log("Seeding timesheet rows...");
  await db.insert(timesheetRowsTable).values(rows).onConflictDoNothing();

  console.log("✅ Database seeded successfully!");
}

  

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
// main().catch(console.error);