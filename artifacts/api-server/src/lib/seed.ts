import { db } from "@workspace/db";
import {
  employeesTable, clientsTable, projectsTable, activitiesTable,
  timesheetsTable, timesheetRowsTable
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (order matters due to FK)
  await db.execute(sql`DELETE FROM timesheet_rows`);
  await db.execute(sql`DELETE FROM timesheets`);
  await db.execute(sql`DELETE FROM notifications`);
  await db.execute(sql`DELETE FROM audit_logs`);
  await db.execute(sql`DELETE FROM employees`);
  await db.execute(sql`DELETE FROM projects`);
  await db.execute(sql`DELETE FROM clients`);
  await db.execute(sql`DELETE FROM activities`);

  // Admin
  const adminId = uuidv4();
  await db.insert(employeesTable).values({
    id: adminId, employeeId: "EMP001", name: "Alice Johnson", email: "alice@versatileit.com",
    department: "Administration", designation: "System Administrator", role: "Admin",
    managerId: null, status: "Active", createdAt: new Date(), updatedAt: new Date(),
  });

  // Manager
  const managerId = uuidv4();
  await db.insert(employeesTable).values({
    id: managerId, employeeId: "EMP002", name: "Bob Williams", email: "bob@versatileit.com",
    department: "Engineering", designation: "Engineering Manager", role: "Manager",
    managerId: adminId, status: "Active", createdAt: new Date(), updatedAt: new Date(),
  });

  // Employees
  const emp1Id = uuidv4();
  const emp2Id = uuidv4();
  const emp3Id = uuidv4();
  await db.insert(employeesTable).values([
    { id: emp1Id, employeeId: "EMP003", name: "Carol Smith", email: "carol@versatileit.com", department: "Engineering", designation: "Senior Developer", role: "Employee", managerId, status: "Active", createdAt: new Date(), updatedAt: new Date() },
    { id: emp2Id, employeeId: "EMP004", name: "David Lee", email: "david@versatileit.com", department: "Engineering", designation: "Developer", role: "Employee", managerId, status: "Active", createdAt: new Date(), updatedAt: new Date() },
    { id: emp3Id, employeeId: "EMP005", name: "Emma Davis", email: "emma@versatileit.com", department: "QA", designation: "QA Engineer", role: "Employee", managerId, status: "Active", createdAt: new Date(), updatedAt: new Date() },
  ]);

  // Clients
  const client1Id = uuidv4();
  const client2Id = uuidv4();
  await db.insert(clientsTable).values([
    { id: client1Id, clientCode: "CLI001", name: "Acme Corporation", status: "Active", createdAt: new Date(), updatedAt: new Date() },
    { id: client2Id, clientCode: "CLI002", name: "TechGlobal Inc.", status: "Active", createdAt: new Date(), updatedAt: new Date() },
  ]);

  // Projects
  const proj1Id = uuidv4();
  const proj2Id = uuidv4();
  const proj3Id = uuidv4();
  await db.insert(projectsTable).values([
    { id: proj1Id, projectCode: "PRJ001", name: "Mobile Banking App", clientId: client1Id, status: "Active", createdAt: new Date(), updatedAt: new Date() },
    { id: proj2Id, projectCode: "PRJ002", name: "ERP Integration", clientId: client1Id, status: "Active", createdAt: new Date(), updatedAt: new Date() },
    { id: proj3Id, projectCode: "PRJ003", name: "Cloud Migration", clientId: client2Id, status: "Active", createdAt: new Date(), updatedAt: new Date() },
  ]);

  // Activity categories
  const actIds: Record<string, string> = {};
  for (const name of ["Development", "Testing", "Support", "Meeting", "Training", "Documentation", "Recruitment", "Leave"]) {
    const id = uuidv4();
    actIds[name] = id;
    await db.insert(activitiesTable).values({ id, name, status: "Active", createdAt: new Date() });
  }

  // Helper to get last Monday
  function getLastMonday(weeksAgo = 0) {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) - weeksAgo * 7;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  }

  const thisWeek = getLastMonday(0);
  const lastWeek = getLastMonday(1);
  const twoWeeksAgo = getLastMonday(2);

  async function createTimesheet(empId: string, weekStart: string, status: "Draft"|"Submitted"|"Approved"|"Rejected", projectId: string, approvedBy?: string, rejectionComment?: string) {
    const tsId = uuidv4();
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const weekEnd = endDate.toISOString().split("T")[0];
    await db.insert(timesheetsTable).values({
      id: tsId, employeeId: empId, weekStartDate: weekStart, weekEndDate: weekEnd,
      status, totalHours: 40,
      submittedAt: status !== "Draft" ? new Date() : null,
      approvedAt: status === "Approved" ? new Date() : null,
      approvedBy: status === "Approved" ? (approvedBy || managerId) : null,
      rejectionComment: status === "Rejected" ? (rejectionComment || "Please add more detail to your tasks.") : null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    await db.insert(timesheetRowsTable).values([
      { id: uuidv4(), timesheetId: tsId, projectId, activityId: actIds["Development"], monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0, totalHours: 40, comments: "Working on feature implementation", createdAt: new Date() },
    ]);
    return tsId;
  }

  // Timesheets for Carol
  await createTimesheet(emp1Id, twoWeeksAgo, "Approved", proj1Id, managerId);
  await createTimesheet(emp1Id, lastWeek, "Submitted", proj1Id);
  await createTimesheet(emp1Id, thisWeek, "Draft", proj2Id);

  // Timesheets for David
  await createTimesheet(emp2Id, twoWeeksAgo, "Approved", proj2Id, managerId);
  await createTimesheet(emp2Id, lastWeek, "Rejected", proj3Id, undefined, "Please add more detail.");
  await createTimesheet(emp2Id, thisWeek, "Draft", proj3Id);

  // Timesheets for Emma
  await createTimesheet(emp3Id, twoWeeksAgo, "Approved", proj1Id, managerId);
  await createTimesheet(emp3Id, lastWeek, "Submitted", proj1Id);

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
