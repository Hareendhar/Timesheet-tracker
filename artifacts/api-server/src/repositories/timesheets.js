// const { store } = require("../data/store");
// const { newId } = require("../lib/id");

const {db,timesheetsTable,timesheetRowsTable,employeesTable,projectsTable,activitiesTable,} = require("@workspace/db");

// const {eq,and,inArray,desc,asc,sql,} = require("drizzle-orm");

const { eq, and, inArray, desc, asc, sql, ilike, or } = require("drizzle-orm");

const crypto = require("crypto");
// const { InvalidTransitionException } = require("../lib/exceptions");



const { InvalidTransitionException } = require("../lib/exceptions");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function calcTotal(row) {
  return DAYS.reduce((sum, d) => sum + Number(row[d] ?? 0), 0);
}

function weekEndDate(weekStartDate) {
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function buildRow(rowId, timesheetId, row, total, now) {
  const r = {
    id: rowId,
    timesheetId,
    projectId: row.projectId?.toString() ?? "",
    activityId: row.activityId?.toString() ?? "",
    totalHours: total,
    comments: row.comments ?? null,
    createdAt: now,
  };
  for (const d of DAYS) r[d] = Number(row[d] ?? 0);
  for (const d of DAYS) {
    r[`${d}Start`] = row[`${d}Start`] ?? null;
    r[`${d}End`] = row[`${d}End`] ?? null;
  }
  return r;
}

// function rowToObj(r) {
//   const project = store.projects.find((p) => p.id === r.projectId);
//   const activity = store.activities.find((a) => a.id === r.activityId);
//   const obj = {
//     id: r.id,
//     timesheetId: r.timesheetId,
//     projectId: r.projectId,
//     projectName: project?.name ?? null,
//     activityId: r.activityId,
//     activityName: activity?.name ?? null,
//     totalHours: r.totalHours,
//     comments: r.comments ?? null,
//   };
//   for (const d of DAYS) obj[d] = r[d];
//   for (const d of DAYS) {
//     obj[`${d}Start`] = r[`${d}Start`] ?? null;
//     obj[`${d}End`] = r[`${d}End`] ?? null;
//   }
//   obj.createdAt = r.createdAt;
//   return obj;
// }

async function enrichTimesheet(ts) {
  const [employee] = await db
    .select({
      name: employeesTable.name,
    })
    .from(employeesTable)
    .where(eq(employeesTable.id, ts.employeeId));

  let approver = null;

  if (ts.approvedBy) {
    [approver] = await db
      .select({
        name: employeesTable.name,
      })
      .from(employeesTable)
      .where(eq(employeesTable.id, ts.approvedBy));
  }

  const rows = await db
    .select({
      id: timesheetRowsTable.id,
      timesheetId: timesheetRowsTable.timesheetId,
      projectId: timesheetRowsTable.projectId,
      projectName: projectsTable.name,
      activityId: timesheetRowsTable.activityId,
      activityName: activitiesTable.name,
      monday: timesheetRowsTable.monday,
      tuesday: timesheetRowsTable.tuesday,
      wednesday: timesheetRowsTable.wednesday,
      thursday: timesheetRowsTable.thursday,
      friday: timesheetRowsTable.friday,
      saturday: timesheetRowsTable.saturday,
      sunday: timesheetRowsTable.sunday,
      totalHours: timesheetRowsTable.totalHours,
      comments: timesheetRowsTable.comments,
      mondayStart: timesheetRowsTable.mondayStart,
      mondayEnd: timesheetRowsTable.mondayEnd,
      tuesdayStart: timesheetRowsTable.tuesdayStart,
      tuesdayEnd: timesheetRowsTable.tuesdayEnd,
      wednesdayStart: timesheetRowsTable.wednesdayStart,
      wednesdayEnd: timesheetRowsTable.wednesdayEnd,
      thursdayStart: timesheetRowsTable.thursdayStart,
      thursdayEnd: timesheetRowsTable.thursdayEnd,
      fridayStart: timesheetRowsTable.fridayStart,
      fridayEnd: timesheetRowsTable.fridayEnd,
      saturdayStart: timesheetRowsTable.saturdayStart,
      saturdayEnd: timesheetRowsTable.saturdayEnd,
      sundayStart: timesheetRowsTable.sundayStart,
      sundayEnd: timesheetRowsTable.sundayEnd,
      createdAt: timesheetRowsTable.createdAt,
    })
    .from(timesheetRowsTable)
    .leftJoin(
      projectsTable,
      eq(timesheetRowsTable.projectId, projectsTable.id)
    )
    .leftJoin(
      activitiesTable,
      eq(timesheetRowsTable.activityId, activitiesTable.id)
    )
    .where(eq(timesheetRowsTable.timesheetId, ts.id));

  return {
    id: ts.id,
    employeeId: ts.employeeId,
    employeeName: employee?.name ?? null,
    weekStartDate: ts.weekStartDate,
    weekEndDate: ts.weekEndDate,
    status: ts.status,
    totalHours: ts.totalHours,
    submittedAt: ts.submittedAt?.toISOString?.() ?? ts.submittedAt,
    approvedAt: ts.approvedAt?.toISOString?.() ?? ts.approvedAt,
    approvedBy: ts.approvedBy ?? null,
    approverName: approver?.name ?? null,
    rejectionComment: ts.rejectionComment ?? null,
    createdAt: ts.createdAt?.toISOString?.() ?? ts.createdAt,
    updatedAt: ts.updatedAt?.toISOString?.() ?? ts.updatedAt,
    rows,
  };
}

// function enrichTimesheet(ts) {
//   const employee = store.employees.find((e) => e.id === ts.employeeId);
//   const approver = ts.approvedBy ? store.employees.find((e) => e.id === ts.approvedBy) : null;
//   const rows = store.timesheetRows.filter((r) => r.timesheetId === ts.id).map(rowToObj);

//   return {
//     id: ts.id,
//     employeeId: ts.employeeId,
//     employeeName: employee?.name ?? null,
//     weekStartDate: ts.weekStartDate,
//     weekEndDate: ts.weekEndDate,
//     status: ts.status,
//     totalHours: ts.totalHours,
//     submittedAt: ts.submittedAt ?? null,
//     approvedAt: ts.approvedAt ?? null,
//     approvedBy: ts.approvedBy ?? null,
//     approverName: approver?.name ?? null,
//     rejectionComment: ts.rejectionComment ?? null,
//     createdAt: ts.createdAt,
//     updatedAt: ts.updatedAt,
//     rows,
//   };
// }

// async function findAll(page, pageSize, employeeId, status, weekStartDate, managerId) {
//   let rows = store.timesheets;

//   if (managerId) {
//     const teamIds = new Set(store.employees.filter((e) => e.managerId === managerId).map((e) => e.id));
//     rows = rows.filter((t) => teamIds.has(t.employeeId));
//   }
//   if (employeeId) rows = rows.filter((t) => t.employeeId === employeeId);
//   if (status) {
//     // Accepts either a single status or a comma-separated list (e.g. "Approved,Rejected").
//     const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
//     rows = rows.filter((t) => statuses.includes(t.status));
//   }
//   if (weekStartDate) rows = rows.filter((t) => t.weekStartDate === weekStartDate);

//   const total = rows.length;
//   const sorted = [...rows].sort((a, b) => {
//     if (a.weekStartDate !== b.weekStartDate) return a.weekStartDate < b.weekStartDate ? 1 : -1;
//     return new Date(b.createdAt) - new Date(a.createdAt);
//   });
//   const offset = (page - 1) * pageSize;
//   const data = sorted.slice(offset, offset + pageSize).map(enrichTimesheet);

//   return { data, total, page, pageSize };
// }

async function findAll(page, pageSize, employeeId, status, weekStartDate, managerId) {
  const conditions = [];

  if (employeeId) {
    conditions.push(eq(timesheetsTable.employeeId, employeeId));
  }

  if (weekStartDate) {
    conditions.push(eq(timesheetsTable.weekStartDate, weekStartDate));
  }

  if (status) {
    const statuses = status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (statuses.length === 1) {
      conditions.push(eq(timesheetsTable.status, statuses[0]));
    } else {
      conditions.push(inArray(timesheetsTable.status, statuses));
    }
  }

  if (managerId) {
    const team = await db
      .select({
        id: employeesTable.id,
      })
      .from(employeesTable)
      .where(eq(employeesTable.managerId, managerId));

    const teamIds = team.map((e) => e.id);

    if (teamIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        pageSize,
      };
    }

    conditions.push(inArray(timesheetsTable.employeeId, teamIds));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(timesheetsTable)
    .where(whereClause)
    .orderBy(
      desc(timesheetsTable.weekStartDate),
      desc(timesheetsTable.createdAt)
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({
      count: sql`count(*)`,
    })
    .from(timesheetsTable)
    .where(whereClause);

  const data = await Promise.all(
    rows.map((ts) => enrichTimesheet(ts))
  );

  return {
    data,
    total: Number(count),
    page,
    pageSize,
  };
}
// async function findById(id) {
//   const ts = store.timesheets.find((t) => t.id === id);
//   return ts ? enrichTimesheet(ts) : null;
// }

async function findById(id) {
  const [ts] = await db
    .select()
    .from(timesheetsTable)
    .where(eq(timesheetsTable.id, id));

  if (!ts) {
    return null;
  }

  return await enrichTimesheet(ts);
}

// async function findByEmployeeAndWeek(employeeId, weekStartDate) {
//   const ts = store.timesheets.find((t) => t.employeeId === employeeId && t.weekStartDate === weekStartDate);
//   return ts ? enrichTimesheet(ts) : null;
// }
async function findByEmployeeAndWeek(employeeId, weekStartDate) {
  const [ts] = await db
    .select()
    .from(timesheetsTable)
    .where(
      and(
        eq(timesheetsTable.employeeId, employeeId),
        eq(timesheetsTable.weekStartDate, weekStartDate)
      )
    );

  if (!ts) return null;

  return findById(ts.id);
}

async function create(employeeId, weekStartDate, rows) {
  const id = crypto.randomUUID();
  const now = new Date();
  let totalHours = 0;

  await db.transaction(async (tx) => {
    for (const row of rows) {
      totalHours += calcTotal(row);
    }

    await tx.insert(timesheetsTable).values({
      id,
      employeeId,
      weekStartDate,
      weekEndDate: weekEndDate(weekStartDate),
      status: "Draft",
      totalHours,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectionComment: null,
      clientSubmittedAt: null,
      clientSubmittedBy: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const row of rows) {
      const total = calcTotal(row);

      await tx.insert(timesheetRowsTable).values({
        id: crypto.randomUUID(),
        timesheetId: id,
        projectId: row.projectId?.toString() ?? "",
        activityId: row.activityId?.toString() ?? "",

        monday: Number(row.monday ?? 0),
        tuesday: Number(row.tuesday ?? 0),
        wednesday: Number(row.wednesday ?? 0),
        thursday: Number(row.thursday ?? 0),
        friday: Number(row.friday ?? 0),
        saturday: Number(row.saturday ?? 0),
        sunday: Number(row.sunday ?? 0),

        totalHours: total,

        comments: row.comments ?? null,

        mondayStart: row.mondayStart ?? null,
        mondayEnd: row.mondayEnd ?? null,
        tuesdayStart: row.tuesdayStart ?? null,
        tuesdayEnd: row.tuesdayEnd ?? null,
        wednesdayStart: row.wednesdayStart ?? null,
        wednesdayEnd: row.wednesdayEnd ?? null,
        thursdayStart: row.thursdayStart ?? null,
        thursdayEnd: row.thursdayEnd ?? null,
        fridayStart: row.fridayStart ?? null,
        fridayEnd: row.fridayEnd ?? null,
        saturdayStart: row.saturdayStart ?? null,
        saturdayEnd: row.saturdayEnd ?? null,
        sundayStart: row.sundayStart ?? null,
        sundayEnd: row.sundayEnd ?? null,

        createdAt: now,
      });
    }
  });

  return await findById(id);
}

// async function update(id, rows) {
//   const ts = store.timesheets.find((t) => t.id === id);
//   if (!ts || (ts.status !== "Draft" && ts.status !== "Rejected")) return null;

//   store.timesheetRows = store.timesheetRows.filter((r) => r.timesheetId !== id);

//   const now = new Date().toISOString();
//   let totalHours = 0;
//   for (const row of rows) {
//     const total = calcTotal(row);
//     totalHours += total;
//     store.timesheetRows.push(buildRow(newId(), id, row, total, now));
//   }
//   ts.totalHours = totalHours;
//   ts.updatedAt = now;
//   return findById(id);
// }

async function update(id, rows) {
  // Check if the timesheet exists and is editable
  const [ts] = await db
    .select()
    .from(timesheetsTable)
    .where(eq(timesheetsTable.id, id));

  if (!ts || (ts.status !== "Draft" && ts.status !== "Rejected")) {
    return null;
  }

  // Delete existing rows
  await db
    .delete(timesheetRowsTable)
    .where(eq(timesheetRowsTable.timesheetId, id));

  const now = new Date();
  let totalHours = 0;

  // Insert new rows
  for (const row of rows) {
    const total = calcTotal(row);
    totalHours += total;

    await db.insert(timesheetRowsTable).values({
      id: crypto.randomUUID(),
      timesheetId: id,
      projectId: row.projectId?.toString() ?? "",
      activityId: row.activityId?.toString() ?? "",

      monday: Number(row.monday ?? 0),
      tuesday: Number(row.tuesday ?? 0),
      wednesday: Number(row.wednesday ?? 0),
      thursday: Number(row.thursday ?? 0),
      friday: Number(row.friday ?? 0),
      saturday: Number(row.saturday ?? 0),
      sunday: Number(row.sunday ?? 0),

      totalHours: total,
      comments: row.comments ?? null,

      mondayStart: row.mondayStart ?? null,
      mondayEnd: row.mondayEnd ?? null,
      tuesdayStart: row.tuesdayStart ?? null,
      tuesdayEnd: row.tuesdayEnd ?? null,
      wednesdayStart: row.wednesdayStart ?? null,
      wednesdayEnd: row.wednesdayEnd ?? null,
      thursdayStart: row.thursdayStart ?? null,
      thursdayEnd: row.thursdayEnd ?? null,
      fridayStart: row.fridayStart ?? null,
      fridayEnd: row.fridayEnd ?? null,
      saturdayStart: row.saturdayStart ?? null,
      saturdayEnd: row.saturdayEnd ?? null,
      sundayStart: row.sundayStart ?? null,
      sundayEnd: row.sundayEnd ?? null,
    });
  }

  // Update timesheet totals
  await db
    .update(timesheetsTable)
    .set({
      totalHours,
      updatedAt: now,
    })
    .where(eq(timesheetsTable.id, id));

  return findById(id);
}

// function transition(id, fromStatuses, attempted, mutate) {
//   const ts = store.timesheets.find((t) => t.id === id);
//   if (!ts) return null;
//   if (!fromStatuses.includes(ts.status)) throw new InvalidTransitionException(ts.status, attempted);
//   mutate(ts);
//   ts.updatedAt = new Date().toISOString();
//   return findById(id);
// }

async function transition(id, fromStatuses, attempted, mutate) {
  const [ts] = await db
    .select()
    .from(timesheetsTable)
    .where(eq(timesheetsTable.id, id));

  if (!ts) {
    return null;
  }

  if (!fromStatuses.includes(ts.status)) {
    throw new InvalidTransitionException(ts.status, attempted);
  }

  // Apply the requested changes (submit/approve/reject)
  mutate(ts);

  ts.updatedAt = new Date();

  await db
    .update(timesheetsTable)
    .set({
      status: ts.status,
      submittedAt: ts.submittedAt,
      approvedAt: ts.approvedAt,
      approvedBy: ts.approvedBy,
      rejectionComment: ts.rejectionComment,
      updatedAt: ts.updatedAt,
    })
    .where(eq(timesheetsTable.id, id));

  return findById(id);
}




async function submit(id) {
  return transition(id, ["Draft", "Rejected"], "submit", (ts) => {
    ts.status = "Submitted";
    ts.submittedAt = new Date();
  });
}

async function approve(id, approvedBy) {
  return transition(id, ["Submitted"], "approve", (ts) => {
    ts.status = "Approved";
    ts.approvedAt = new Date();
    ts.approvedBy = approvedBy;
  });
}

async function reject(id, comment) {
  return transition(id, ["Submitted"], "reject", (ts) => {
    ts.status = "Rejected";
    ts.rejectionComment = comment;
  });
}

async function bulkAction(ids, action, approvedBy, comment) {
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      if (action === "approve") await approve(id, approvedBy);
      else await reject(id, comment ?? "Rejected");
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { processed: ids.length, succeeded, failed };
}

async function copyFromPreviousWeek(employeeId, sourceWeekStartDate, targetWeekStartDate) {
  const source = await findByEmployeeAndWeek(employeeId, sourceWeekStartDate);
  if (!source) throw new Error("Source week not found");

  const existing = await findByEmployeeAndWeek(employeeId, targetWeekStartDate);
  if (existing) return existing;

  const rows = source.rows.map((r) => {
    const row = {
      projectId: r.projectId,
      activityId: r.activityId,
      comments: r.comments,
    };
    for (const d of DAYS) row[d] = r[d];
    for (const d of DAYS) {
      row[`${d}Start`] = r[`${d}Start`];
      row[`${d}End`] = r[`${d}End`];
    }
    return row;
  });

  return create(employeeId, targetWeekStartDate, rows);
}

// async function getStatusBreakdown() {
//   return {
//     draft: store.timesheets.filter((t) => t.status === "Draft").length,
//     submitted: store.timesheets.filter((t) => t.status === "Submitted").length,
//     approved: store.timesheets.filter((t) => t.status === "Approved").length,
//     rejected: store.timesheets.filter((t) => t.status === "Rejected").length,
//   };
// }

async function getStatusBreakdown() {
  const rows = await db
    .select({
      status: timesheetsTable.status,
      count: sql`count(*)`,
    })
    .from(timesheetsTable)
    .groupBy(timesheetsTable.status);

  const result = {
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case "Draft":
        result.draft = Number(row.count);
        break;
      case "Submitted":
        result.submitted = Number(row.count);
        break;
      case "Approved":
        result.approved = Number(row.count);
        break;
      case "Rejected":
        result.rejected = Number(row.count);
        break;
    }
  }

  return result;
}

// async function getRecentActivity(limit) {
//   const sorted = [...store.timesheets].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
//   return sorted.slice(0, limit).map((t) => {
//     const employee = store.employees.find((e) => e.id === t.employeeId);
//     return {
//       id: t.id,
//       action: t.status,
//       employeeName: employee?.name ?? null,
//       weekStartDate: t.weekStartDate,
//       timestamp: t.updatedAt,
//       timesheetId: t.id,
//     };
//   });
// }

async function getRecentActivity(limit) {
  const rows = await db
    .select({
      id: timesheetsTable.id,
      action: timesheetsTable.status,
      employeeName: employeesTable.name,
      weekStartDate: timesheetsTable.weekStartDate,
      timestamp: timesheetsTable.updatedAt,
    })
    .from(timesheetsTable)
    .leftJoin(
      employeesTable,
      eq(timesheetsTable.employeeId, employeesTable.id)
    )
    .orderBy(desc(timesheetsTable.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    employeeName: r.employeeName ?? null,
    weekStartDate: r.weekStartDate,
    timestamp: r.timestamp?.toISOString?.() ?? r.timestamp,
    timesheetId: r.id,
  }));
}

// async function getComplianceOverview() {
//   const fourWeeksAgo = new Date();
//   fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
//   const cutoff = fourWeeksAgo.toISOString().slice(0, 10);

//   const activeEmployees = store.employees.filter((e) => e.status === "Active");
//   const departments = [...new Set(activeEmployees.map((e) => e.department))].sort();

//   return departments.map((department) => {
//     const deptEmployees = activeEmployees.filter((e) => e.department === department);
//     const deptIds = new Set(deptEmployees.map((e) => e.id));
//     const submittedIds = new Set(
//       store.timesheets
//         .filter(
//           (t) =>
//             deptIds.has(t.employeeId) &&
//             t.weekStartDate >= cutoff &&
//             ["Submitted", "Approved"].includes(t.status),
//         )
//         .map((t) => t.employeeId),
//     );
//     const total = deptEmployees.length;
//     const submitted = submittedIds.size;
//     return {
//       department,
//       totalEmployees: total,
//       submitted,
//       complianceRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
//     };
//   });
// }

async function getComplianceOverview() {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const cutoff = fourWeeksAgo.toISOString().slice(0, 10);

  const employees = await db
    .select({
      id: employeesTable.id,
      department: employeesTable.department,
    })
    .from(employeesTable)
    .where(eq(employeesTable.status, "Active"));

  const timesheets = await db
    .select({
      employeeId: timesheetsTable.employeeId,
      weekStartDate: timesheetsTable.weekStartDate,
      status: timesheetsTable.status,
    })
    .from(timesheetsTable)
    .where(
      and(
        inArray(timesheetsTable.status, ["Submitted", "Approved"]),
        sql`${timesheetsTable.weekStartDate} >= ${cutoff}`
      )
    );

  const departments = [...new Set(employees.map(e => e.department))].sort();

  return departments.map((department) => {
    const deptEmployees = employees.filter(
      (e) => e.department === department
    );

    const deptIds = new Set(deptEmployees.map((e) => e.id));

    const submittedIds = new Set(
      timesheets
        .filter((t) => deptIds.has(t.employeeId))
        .map((t) => t.employeeId)
    );

    const total = deptEmployees.length;
    const submitted = submittedIds.size;

    return {
      department,
      totalEmployees: total,
      submitted,
      complianceRate:
        total > 0 ? Math.round((submitted / total) * 100) : 0,
    };
  });
}

async function searchTimesheets(q, limit, managerId = null) {
  const rows = await db
    .select({
      id: timesheetsTable.id,
      employeeId: timesheetsTable.employeeId,
      weekStartDate: timesheetsTable.weekStartDate,
      weekEndDate: timesheetsTable.weekEndDate,
      status: timesheetsTable.status,
      totalHours: timesheetsTable.totalHours,
      updatedAt: timesheetsTable.updatedAt,
      employeeName: employeesTable.name,
      managerId: employeesTable.managerId,
    })
    .from(timesheetsTable)
    .leftJoin(
      employeesTable,
      eq(timesheetsTable.employeeId, employeesTable.id)
    )
    .where(
      or(
        ilike(employeesTable.name, `%${q}%`),
        ilike(timesheetsTable.weekStartDate, `%${q}%`)
      )
    )
    .orderBy(desc(timesheetsTable.updatedAt));

  let result = rows;

  if (managerId) {
    result = result.filter((r) => r.managerId === managerId);
  }

  return result.slice(0, limit).map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    weekStartDate: r.weekStartDate,
    weekEndDate: r.weekEndDate,
    status: r.status,
    totalHours: r.totalHours,
    employeeName: r.employeeName,
  }));
}

module.exports = {
  findAll,
  findById,
  findByEmployeeAndWeek,
  create,
  update,
  submit,
  approve,
  reject,
  bulkAction,
  copyFromPreviousWeek,
  getStatusBreakdown,
  getRecentActivity,
  getComplianceOverview,
  searchTimesheets,
};
