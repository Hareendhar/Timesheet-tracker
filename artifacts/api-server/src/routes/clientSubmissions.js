const express = require("express");
const ExcelJS = require("exceljs");

const timesheetRepo = require("../repositories/timesheets");
// const { store } = require("../data/store");

// const { db } = require("@workspace/db");
const {
  db,
  employeesTable,
  clientsTable,
  projectsTable,
  activitiesTable,
  timesheetsTable,
  timesheetRowsTable,
} = require("@workspace/db");

// const {eq,and,inArray,desc,} = require("drizzle-orm");
const { eq, and, inArray, desc, ilike } = require("drizzle-orm");


const auditRepo = require("../repositories/audit");
const { requireRole, asyncHandler } = require("../lib/auth");
const { getClientIp } = require("../lib/clientIp");

const router = express.Router();
router.use(requireRole("HR"));

// function rowsForTimesheet(timesheetId) {
//   return store.timesheetRows.filter((r) => r.timesheetId === timesheetId);
// }



// function projectsForTimesheet(timesheetId) {
//   const projectIds = new Set(rowsForTimesheet(timesheetId).map((r) => r.projectId));
//   return [...projectIds].map((id) => store.projects.find((p) => p.id === id)).filter(Boolean);
// }


async function rowsForTimesheet(timesheetId) {
  return await db
    .select()
    .from(timesheetRowsTable)
    .where(eq(timesheetRowsTable.timesheetId, timesheetId));
}

async function projectsForTimesheet(timesheetId) {
  const rows = await rowsForTimesheet(timesheetId);

  if (!rows.length) return [];

  const projectIds = rows.map((r) => r.projectId);

  return await db
    .select()
    .from(projectsTable)
    .where(inArray(projectsTable.id, projectIds));
}

// function buildSummaryRow(t) {
//   const employee = store.employees.find((e) => e.id === t.employeeId);
//   const manager = employee?.managerId ? store.employees.find((e) => e.id === employee.managerId) : null;
//   const projects = projectsForTimesheet(t.id);
//   const clients = projects
//     .map((p) => store.clients.find((c) => c.id === p.clientId))
//     .filter(Boolean);

//   const uniqueSorted = (arr) => [...new Set(arr)].sort();

//   return {
//     id: t.id,
//     employeeId: t.employeeId,
//     weekStartDate: t.weekStartDate,
//     weekEndDate: t.weekEndDate,
//     status: t.status,
//     totalHours: t.totalHours,
//     submittedAt: t.submittedAt ?? null,
//     approvedAt: t.approvedAt ?? null,
//     approvedBy: t.approvedBy ?? null,
//     clientSubmittedAt: t.clientSubmittedAt ?? null,
//     clientSubmittedBy: t.clientSubmittedBy ?? null,
//     employeeName: employee?.name ?? null,
//     employeeCode: employee?.employeeId ?? null,
//     department: employee?.department ?? null,
//     managerName: manager?.name ?? null,
//     projectNames: uniqueSorted(projects.map((p) => p.name)).join(", ") || null,
//     projectCodes: uniqueSorted(projects.map((p) => p.projectCode)).join(", ") || null,
//     clientNames: uniqueSorted(clients.map((c) => c.name)).join(", ") || null,
//     clientManagerNames: uniqueSorted(projects.map((p) => p.clientManagerName).filter(Boolean)).join(", ") || null,
//     clientManagerEmails: uniqueSorted(projects.map((p) => p.clientManagerEmail).filter(Boolean)).join(", ") || null,
//   };
// }

async function buildSummaryRow(t) {
  const employee = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, t.employeeId))
    .then((rows) => rows[0]);

  const manager = employee?.managerId
    ? await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employee.managerId))
      .then((rows) => rows[0])
    : null;

  const projects = await projectsForTimesheet(t.id);

  const uniqueSorted = (arr) => [...new Set(arr)].sort();

  return {
    id: t.id,
    employeeId: t.employeeId,
    weekStartDate: t.weekStartDate,
    weekEndDate: t.weekEndDate,
    status: t.status,
    totalHours: t.totalHours,
    submittedAt: t.submittedAt ?? null,
    approvedAt: t.approvedAt ?? null,
    approvedBy: t.approvedBy ?? null,
    clientSubmittedAt: t.clientSubmittedAt ?? null,
    clientSubmittedBy: t.clientSubmittedBy ?? null,

    employeeName: employee?.name ?? null,
    employeeCode: employee?.employeeId ?? null,
    department: employee?.department ?? null,
    managerName: manager?.name ?? null,

    projectNames: uniqueSorted(projects.map((p) => p.name)).join(", ") || null,
    projectCodes: uniqueSorted(projects.map((p) => p.projectCode)).join(", ") || null,
    clientNames: uniqueSorted(projects.map((p) => p.clientName)).join(", ") || null,

    clientManagerNames: uniqueSorted(
      projects.map((p) => p.clientManagerName).filter(Boolean)
    ).join(", ") || null,

    clientManagerEmails: uniqueSorted(
      projects.map((p) => p.clientManagerEmail).filter(Boolean)
    ).join(", ") || null,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    // console.log("CLIENT SUBMISSIONS GET START");
    const { page = 1, pageSize = 20, projectId, clientManagerEmail, managerId, status } = req.query;



    const conditions = [
      inArray(timesheetsTable.status, ["Approved", "ClientSubmitted"]),
    ];

    if (status) {
      conditions.push(eq(timesheetsTable.status, status));
    }

    let rows = await db
      .select()
      .from(timesheetsTable)
      .where(and(...conditions))
      .orderBy(desc(timesheetsTable.weekStartDate));

    if (managerId) {
      const team = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.managerId, managerId));

      const employeeIds = new Set(team.map((e) => e.id));

      rows = rows.filter((t) => employeeIds.has(t.employeeId));
    }

    if (projectId) {
      const projectRows = await db
        .select()
        .from(timesheetRowsTable)
        .where(eq(timesheetRowsTable.projectId, projectId));

      const ids = new Set(projectRows.map((r) => r.timesheetId));

      rows = rows.filter((t) => ids.has(t.id));
    }

    if (clientManagerEmail) {
      const projects = await db
        .select({
          timesheetId: timesheetRowsTable.timesheetId,
          email: projectsTable.clientManagerEmail,
        })
        .from(timesheetRowsTable)
        .innerJoin(
          projectsTable,
          eq(timesheetRowsTable.projectId, projectsTable.id)
        );

      const q = clientManagerEmail.toLowerCase();

      const ids = new Set(
        projects
          .filter((p) =>
            p.email?.toLowerCase().includes(q)
          )
          .map((p) => p.timesheetId)
      );

      rows = rows.filter((t) => ids.has(t.id));
    }

    const total = rows.length;

    const offset =
      (Number(page) - 1) * Number(pageSize);

    const data = await Promise.all(
      rows
        .slice(offset, offset + Number(pageSize))
        .map(buildSummaryRow)
    );

    // console.log("CLIENT SUBMISSIONS DATA READY", data.length);

    res.json({
      data,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    // let rows = store.timesheets.filter((t) => ["Approved", "ClientSubmitted"].includes(t.status));
    // if (status) rows = rows.filter((t) => t.status === status);
    // if (managerId) {
    //   const teamIds = new Set(store.employees.filter((e) => e.managerId === managerId).map((e) => e.id));
    //   rows = rows.filter((t) => teamIds.has(t.employeeId));
    // }
    // if (projectId) rows = rows.filter((t) => rowsForTimesheet(t.id).some((r) => r.projectId === projectId));
    // if (clientManagerEmail) {
    //   const q = clientManagerEmail.toLowerCase();
    //   rows = rows.filter((t) =>
    //     projectsForTimesheet(t.id).some((p) => p.clientManagerEmail?.toLowerCase().includes(q)),
    //   );
    // }

    // const total = rows.length;
    // const sorted = [...rows].sort((a, b) => {
    //   if (a.weekStartDate !== b.weekStartDate) return a.weekStartDate < b.weekStartDate ? 1 : -1;
    //   return new Date(b.createdAt) - new Date(a.createdAt);
    // });
    // const offset = (Number(page) - 1) * Number(pageSize);
    // const data = sorted.slice(offset, offset + Number(pageSize)).map(buildSummaryRow);

    // res.json({ data, total, page: Number(page), pageSize: Number(pageSize) });
  }),
);

router.post(
  "/submit",
  asyncHandler(async (req, res) => {
    const { timesheetIds } = req.body ?? {};
    if (!Array.isArray(timesheetIds) || timesheetIds.length === 0)
      return res.status(400).json({ error: "timesheetIds is required" });

    const user = req.session.user;


    const now = new Date();
    let submitted = 0;

    for (const tsId of timesheetIds) {
      const result = await db
        .update(timesheetsTable)
        .set({
          status: "ClientSubmitted",
          clientSubmittedAt: now,
          clientSubmittedBy: user.name,
          updatedAt: now,
        })
        .where(
          and(
            eq(timesheetsTable.id, tsId),
            eq(timesheetsTable.status, "Approved")
          )
        )
        .returning();

      if (result.length > 0) {
        submitted++;
      }
    }
    // const now = new Date().toISOString();
    // let submitted = 0;

    // for (const tsId of timesheetIds) {
    //   const ts = store.timesheets.find((t) => t.id === tsId && t.status === "Approved");
    //   if (ts) {
    //     ts.status = "ClientSubmitted";
    //     ts.clientSubmittedAt = now;
    //     ts.clientSubmittedBy = user.name;
    //     ts.updatedAt = now;
    //     submitted++;
    //   }
    // }

    await auditRepo.create({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "Client Submission Sent",
      entityType: "Timesheet",
      entityId: timesheetIds.join(","),
      newValue: `Submitted ${submitted} timesheet(s) to client manager`,
      ipAddress: getClientIp(req),
    });

    res.json({ submitted });
  }),
);

router.get(
  "/download",
  asyncHandler(async (req, res) => {
    const ids = (req.query.ids ?? "").toString().split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: "ids is required" });

    const detailRows = [];
    for (const tsId of ids) {

      const t = await db
        .select()
        .from(timesheetsTable)
        .where(eq(timesheetsTable.id, tsId))
        .then((rows) => rows[0]);

      if (!t) continue;


      const employee = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, t.employeeId))
        .then((rows) => rows[0]);


      const manager = employee?.managerId
        ? await db
          .select()
          .from(employeesTable)
          .where(eq(employeesTable.id, employee.managerId))
          .then((rows) => rows[0])
        : null;


      const timesheetRows = await rowsForTimesheet(t.id);

      for (const r of timesheetRows) {
        // const project = store.projects.find((p) => p.id === r.projectId);
        const project = await db
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, r.projectId))
          .then((rows) => rows[0]);
        // const client = project ? store.clients.find((c) => c.id === project.clientId) : null;
        const client = project
  ? await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, project.clientId))
      .then((rows) => rows[0])
  : null;
        // const activity = store.activities.find((a) => a.id === r.activityId);
        const activity = await db
  .select()
  .from(activitiesTable)
  .where(eq(activitiesTable.id, r.activityId))
  .then((rows) => rows[0]);
        detailRows.push({
          employee_name: employee?.name ?? "",
          employee_code: employee?.employeeId ?? "",
          department: employee?.department ?? "",
          manager_name: manager?.name ?? "",
          project_code: project?.projectCode ?? "",
          project_name: project?.name ?? "",
          client_name: client?.name ?? "",
          client_manager_name: project?.clientManagerName ?? "",
          client_manager_email: project?.clientManagerEmail ?? "",
          week_start_date: t.weekStartDate,
          week_end_date: t.weekEndDate,
          activity_name: activity?.name ?? "",
          monday: r.monday, tuesday: r.tuesday, wednesday: r.wednesday, thursday: r.thursday,
          friday: r.friday, saturday: r.saturday, sunday: r.sunday,
          row_total_hours: r.totalHours,
          timesheet_total_hours: t.totalHours,
          status: t.status,
          submitted_at: t.submittedAt,
          approved_at: t.approvedAt,
          client_submitted_at: t.clientSubmittedAt,
          comments: r.comments ?? "",
        });
      }
    }
    detailRows.sort((a, b) =>
      a.week_start_date !== b.week_start_date
        ? a.week_start_date.localeCompare(b.week_start_date)
        : a.employee_name.localeCompare(b.employee_name) || a.project_name.localeCompare(b.project_name),
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Timesheets");
    const headers = [
      "Employee Name", "Employee ID", "Department", "Internal Manager",
      "Project Code", "Project Name", "Client", "Client Manager", "Client Manager Email",
      "Week Start", "Week End", "Activity",
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
      "Row Total Hrs", "Timesheet Total Hrs",
      "Status", "Submitted Date", "Approved Date", "Client Submitted Date", "Comments",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C75BC" } };
      cell.alignment = { horizontal: "center" };
    });

    const dateOnly = (v) => (v ? v.toString().slice(0, 10) : "");
    detailRows.forEach((r) => {
      ws.addRow([
        r.employee_name, r.employee_code, r.department, r.manager_name,
        r.project_code, r.project_name, r.client_name, r.client_manager_name, r.client_manager_email,
        r.week_start_date, r.week_end_date, r.activity_name,
        r.monday, r.tuesday, r.wednesday, r.thursday, r.friday, r.saturday, r.sunday,
        r.row_total_hours, r.timesheet_total_hours,
        r.status, dateOnly(r.submitted_at), dateOnly(r.approved_at), dateOnly(r.client_submitted_at),
        r.comments,
      ]);
    });
    ws.columns.forEach((col) => (col.width = 16));
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `timesheets_${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  }),
);

module.exports = router;
