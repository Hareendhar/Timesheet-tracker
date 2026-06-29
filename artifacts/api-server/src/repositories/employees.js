const { store } = require("../data/store");
const { newId } = require("../lib/id");

const VALID_ROLES = ["Employee", "Manager", "HR"];
const VALID_STATUSES = ["Active", "Inactive"];

function toObj(e, managerName) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    name: e.name,
    email: e.email,
    department: e.department,
    designation: e.designation,
    role: e.role,
    managerId: e.managerId ?? null,
    managerName: managerName ?? null,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function managerNameOf(managerId) {
  if (!managerId) return null;
  const mgr = store.employees.find((e) => e.id === managerId);
  return mgr?.name ?? null;
}

async function findAll(page, pageSize, search, role, status, department, managerId) {
  let rows = store.employees;

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q),
    );
  }
  if (role) rows = rows.filter((e) => e.role === role);
  if (status) rows = rows.filter((e) => e.status === status);
  if (department) rows = rows.filter((e) => e.department.toLowerCase().includes(department.toLowerCase()));
  if (managerId) rows = rows.filter((e) => e.managerId === managerId);

  rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  const page_ = rows.slice(offset, offset + pageSize).map((e) => toObj(e, managerNameOf(e.managerId)));

  return { data: page_, total, page, pageSize };
}

async function findById(id) {
  const e = store.employees.find((x) => x.id === id);
  if (!e) return null;
  return toObj(e, managerNameOf(e.managerId));
}

async function findByEmail(email) {
  const target = email?.toLowerCase();
  const e = store.employees.find((x) => x.email.toLowerCase() === target);
  if (!e) return null;
  return toObj(e, managerNameOf(e.managerId));
}

async function findByEmployeeId(employeeId) {
  const e = store.employees.find((x) => x.employeeId === employeeId);
  if (!e) return null;
  return toObj(e, managerNameOf(e.managerId));
}

async function create(data) {
  const now = new Date().toISOString();
  const e = {
    id: newId(),
    employeeId: data.employeeId?.toString() ?? "",
    name: data.name?.toString() ?? "",
    email: data.email?.toString() ?? "",
    department: data.department?.toString() ?? "",
    designation: data.designation?.toString() ?? "",
    role: VALID_ROLES.includes(data.role) ? data.role : "Employee",
    managerId: data.managerId ?? null,
    status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
    createdAt: now,
    updatedAt: now,
  };
  store.employees.push(e);
  return findById(e.id);
}

async function update(id, data) {
  const e = store.employees.find((x) => x.id === id);
  if (!e) return null;
  if (data.employeeId != null) e.employeeId = data.employeeId.toString();
  if (data.name != null) e.name = data.name.toString();
  if (data.email != null) e.email = data.email.toString();
  if (data.department != null) e.department = data.department.toString();
  if (data.designation != null) e.designation = data.designation.toString();
  if (data.role != null && VALID_ROLES.includes(data.role)) e.role = data.role;
  if (data.status != null && VALID_STATUSES.includes(data.status)) e.status = data.status;
  if ("managerId" in data) e.managerId = data.managerId ?? null;
  e.updatedAt = new Date().toISOString();
  return findById(id);
}

async function deleteEmployee(id) {
  const e = store.employees.find((x) => x.id === id);
  if (!e) return false;
  e.status = "Inactive";
  e.updatedAt = new Date().toISOString();
  return true;
}

async function bulkCreate(rows) {
  const success = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const empId = row.employeeId?.toString() ?? "";
      const name = row.name?.toString() ?? "";
      const email = row.email?.toString() ?? "";
      const role = row.role;
      const status = row.status;

      if (!empId) throw new Error("Missing Employee ID");
      if (!name) throw new Error("Missing Name");
      if (!email) throw new Error("Missing Email");
      if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role: ${role}`);
      if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);

      if (store.employees.some((e) => e.employeeId === empId)) throw new Error(`Duplicate Employee ID: ${empId}`);
      if (store.employees.some((e) => e.email === email)) throw new Error(`Duplicate Email: ${email}`);

      let resolvedManagerId = null;
      if (row.managerId) {
        const mgr = store.employees.find((e) => e.employeeId === row.managerId.toString());
        if (!mgr) throw new Error(`Manager not found: ${row.managerId}`);
        resolvedManagerId = mgr.id;
      }

      row.managerId = resolvedManagerId;
      const created = await create(row);
      success.push(created);
    } catch (err) {
      errors.push({ row: i + 1, field: "unknown", message: err.message });
    }
  }

  return { success, errors };
}

async function getProfile(id) {
  const employee = await findById(id);
  if (!employee) return null;

  const ts = store.timesheets.filter((t) => t.employeeId === id);
  const totalSubmitted = ts.length;
  const approved = ts.filter((t) => t.status === "Approved").length;
  const pending = ts.filter((t) => t.status === "Draft" || t.status === "Submitted").length;
  const rejected = ts.filter((t) => t.status === "Rejected").length;
  const approvalRate = totalSubmitted > 0 ? Math.round((approved / totalSubmitted) * 100) : 0;

  return { employee, metrics: { totalSubmitted, approved, pending, rejected, approvalRate } };
}

async function getDirectReports(managerId) {
  const manager = await findById(managerId);
  if (!manager) return null;

  const reports = store.employees.filter((e) => e.managerId === managerId);

  const directReports = reports.map((emp) => {
    const ts = store.timesheets.filter((t) => t.employeeId === emp.id);
    const submitted = ts.filter((t) => ["Submitted", "Approved", "Rejected"].includes(t.status)).length;
    const approved = ts.filter((t) => t.status === "Approved").length;
    const rejected = ts.filter((t) => t.status === "Rejected").length;
    return {
      employee: toObj(emp, manager.name),
      submitted,
      approved,
      rejected,
    };
  });

  const reportIds = new Set(reports.map((e) => e.id));
  const teamTs = store.timesheets.filter((t) => reportIds.has(t.employeeId));
  const mmApproved = teamTs.filter((t) => t.status === "Approved").length;
  const mmRejected = teamTs.filter((t) => t.status === "Rejected").length;
  const mmPending = teamTs.filter((t) => t.status === "Submitted").length;

  return {
    manager,
    metrics: {
      totalReports: reports.length,
      approved: mmApproved,
      rejected: mmRejected,
      pendingApprovals: mmPending,
    },
    directReports,
  };
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  findByEmployeeId,
  create,
  update,
  delete: deleteEmployee,
  bulkCreate,
  getProfile,
  getDirectReports,
};
