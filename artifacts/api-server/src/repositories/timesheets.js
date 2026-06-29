const { store } = require("../data/store");
const { newId } = require("../lib/id");
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

function rowToObj(r) {
  const project = store.projects.find((p) => p.id === r.projectId);
  const activity = store.activities.find((a) => a.id === r.activityId);
  const obj = {
    id: r.id,
    timesheetId: r.timesheetId,
    projectId: r.projectId,
    projectName: project?.name ?? null,
    activityId: r.activityId,
    activityName: activity?.name ?? null,
    totalHours: r.totalHours,
    comments: r.comments ?? null,
  };
  for (const d of DAYS) obj[d] = r[d];
  for (const d of DAYS) {
    obj[`${d}Start`] = r[`${d}Start`] ?? null;
    obj[`${d}End`] = r[`${d}End`] ?? null;
  }
  obj.createdAt = r.createdAt;
  return obj;
}

function enrichTimesheet(ts) {
  const employee = store.employees.find((e) => e.id === ts.employeeId);
  const approver = ts.approvedBy ? store.employees.find((e) => e.id === ts.approvedBy) : null;
  const rows = store.timesheetRows.filter((r) => r.timesheetId === ts.id).map(rowToObj);

  return {
    id: ts.id,
    employeeId: ts.employeeId,
    employeeName: employee?.name ?? null,
    weekStartDate: ts.weekStartDate,
    weekEndDate: ts.weekEndDate,
    status: ts.status,
    totalHours: ts.totalHours,
    submittedAt: ts.submittedAt ?? null,
    approvedAt: ts.approvedAt ?? null,
    approvedBy: ts.approvedBy ?? null,
    approverName: approver?.name ?? null,
    rejectionComment: ts.rejectionComment ?? null,
    createdAt: ts.createdAt,
    updatedAt: ts.updatedAt,
    rows,
  };
}

async function findAll(page, pageSize, employeeId, status, weekStartDate, managerId) {
  let rows = store.timesheets;

  if (managerId) {
    const teamIds = new Set(store.employees.filter((e) => e.managerId === managerId).map((e) => e.id));
    rows = rows.filter((t) => teamIds.has(t.employeeId));
  }
  if (employeeId) rows = rows.filter((t) => t.employeeId === employeeId);
  if (status) {
    // Accepts either a single status or a comma-separated list (e.g. "Approved,Rejected").
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    rows = rows.filter((t) => statuses.includes(t.status));
  }
  if (weekStartDate) rows = rows.filter((t) => t.weekStartDate === weekStartDate);

  const total = rows.length;
  const sorted = [...rows].sort((a, b) => {
    if (a.weekStartDate !== b.weekStartDate) return a.weekStartDate < b.weekStartDate ? 1 : -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const offset = (page - 1) * pageSize;
  const data = sorted.slice(offset, offset + pageSize).map(enrichTimesheet);

  return { data, total, page, pageSize };
}

async function findById(id) {
  const ts = store.timesheets.find((t) => t.id === id);
  return ts ? enrichTimesheet(ts) : null;
}

async function findByEmployeeAndWeek(employeeId, weekStartDate) {
  const ts = store.timesheets.find((t) => t.employeeId === employeeId && t.weekStartDate === weekStartDate);
  return ts ? enrichTimesheet(ts) : null;
}

async function create(employeeId, weekStartDate, rows) {
  const id = newId();
  const now = new Date().toISOString();
  let totalHours = 0;

  const ts = {
    id,
    employeeId,
    weekStartDate,
    weekEndDate: weekEndDate(weekStartDate),
    status: "Draft",
    totalHours: 0,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    rejectionComment: null,
    clientSubmittedAt: null,
    clientSubmittedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  store.timesheets.push(ts);

  for (const row of rows) {
    const total = calcTotal(row);
    totalHours += total;
    store.timesheetRows.push(buildRow(newId(), id, row, total, now));
  }

  ts.totalHours = totalHours;
  ts.updatedAt = now;
  return findById(id);
}

async function update(id, rows) {
  const ts = store.timesheets.find((t) => t.id === id);
  if (!ts || (ts.status !== "Draft" && ts.status !== "Rejected")) return null;

  store.timesheetRows = store.timesheetRows.filter((r) => r.timesheetId !== id);

  const now = new Date().toISOString();
  let totalHours = 0;
  for (const row of rows) {
    const total = calcTotal(row);
    totalHours += total;
    store.timesheetRows.push(buildRow(newId(), id, row, total, now));
  }
  ts.totalHours = totalHours;
  ts.updatedAt = now;
  return findById(id);
}

function transition(id, fromStatuses, attempted, mutate) {
  const ts = store.timesheets.find((t) => t.id === id);
  if (!ts) return null;
  if (!fromStatuses.includes(ts.status)) throw new InvalidTransitionException(ts.status, attempted);
  mutate(ts);
  ts.updatedAt = new Date().toISOString();
  return findById(id);
}

async function submit(id) {
  return transition(id, ["Draft", "Rejected"], "submit", (ts) => {
    ts.status = "Submitted";
    ts.submittedAt = new Date().toISOString();
  });
}

async function approve(id, approvedBy) {
  return transition(id, ["Submitted"], "approve", (ts) => {
    ts.status = "Approved";
    ts.approvedAt = new Date().toISOString();
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

async function getStatusBreakdown() {
  return {
    draft: store.timesheets.filter((t) => t.status === "Draft").length,
    submitted: store.timesheets.filter((t) => t.status === "Submitted").length,
    approved: store.timesheets.filter((t) => t.status === "Approved").length,
    rejected: store.timesheets.filter((t) => t.status === "Rejected").length,
  };
}

async function getRecentActivity(limit) {
  const sorted = [...store.timesheets].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return sorted.slice(0, limit).map((t) => {
    const employee = store.employees.find((e) => e.id === t.employeeId);
    return {
      id: t.id,
      action: t.status,
      employeeName: employee?.name ?? null,
      weekStartDate: t.weekStartDate,
      timestamp: t.updatedAt,
      timesheetId: t.id,
    };
  });
}

async function getComplianceOverview() {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const cutoff = fourWeeksAgo.toISOString().slice(0, 10);

  const activeEmployees = store.employees.filter((e) => e.status === "Active");
  const departments = [...new Set(activeEmployees.map((e) => e.department))].sort();

  return departments.map((department) => {
    const deptEmployees = activeEmployees.filter((e) => e.department === department);
    const deptIds = new Set(deptEmployees.map((e) => e.id));
    const submittedIds = new Set(
      store.timesheets
        .filter(
          (t) =>
            deptIds.has(t.employeeId) &&
            t.weekStartDate >= cutoff &&
            ["Submitted", "Approved"].includes(t.status),
        )
        .map((t) => t.employeeId),
    );
    const total = deptEmployees.length;
    const submitted = submittedIds.size;
    return {
      department,
      totalEmployees: total,
      submitted,
      complianceRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
    };
  });
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
};
