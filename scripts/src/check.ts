import {
  db,
  employeesTable,
  clientsTable,
  projectsTable,
  activitiesTable,
  timesheetsTable,
  timesheetRowsTable,
} from "@workspace/db";



async function main() {
  console.log("=== Employees ===");
  console.table(await db.select().from(employeesTable));

  console.log("=== Clients ===");
  console.table(await db.select().from(clientsTable));

  console.log("=== Activities ===");
  console.table(await db.select().from(activitiesTable));

  console.log("=== Projects ===");
  console.table(await db.select().from(projectsTable));

  console.log("=== Timesheets ===");
  console.table(await db.select().from(timesheetsTable));

  console.log("=== Timesheet Rows ===");
  console.table(await db.select().from(timesheetRowsTable));
}




main()
  .catch(console.error)
  .finally(() => process.exit(0));