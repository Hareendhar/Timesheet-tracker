// const { store } = require("../data/store");
// const { newId } = require("../lib/id");

const { db, employeesTable } = require("@workspace/db");
// const { eq, and, ilike, or, desc } = require("drizzle-orm");
const { eq, and, ilike, or, desc, inArray } = require("drizzle-orm");
const crypto = require("crypto");
const { timesheetsTable } = require("@workspace/db");

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

// function managerNameOf(managerId) {
//   if (!managerId) return null;
//   const mgr = store.employees.find((e) => e.id === managerId);
//   return mgr?.name ?? null;
// }

async function managerNameOf(managerId) {
  if (!managerId) return null;

  const [mgr] = await db
    .select({ name: employeesTable.name })
    .from(employeesTable)
    .where(eq(employeesTable.id, managerId));

  return mgr?.name ?? null;
}

async function findAll(page, pageSize, search, role, status, department, managerId) {
  let conditions = [];

  if (search) {
    const q = `%${search.toLowerCase()}%`;

    conditions.push(
      or(
        ilike(employeesTable.name, q),
        ilike(employeesTable.email, q),
        ilike(employeesTable.employeeId, q)
      )
    );
  }

  if (role) {
    conditions.push(eq(employeesTable.role, role));
  }

  if (status) {
    conditions.push(eq(employeesTable.status, status));
  }

  if (department) {
    conditions.push(
      ilike(employeesTable.department, `%${department}%`)
    );
  }

  if (managerId) {
    conditions.push(eq(employeesTable.managerId, managerId));
  }

  const rows = await db
    .select()
    .from(employeesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(employeesTable.name);


  const total = rows.length;

  const offset = (page - 1) * pageSize;

  const pageRows = rows
    .slice(offset, offset + pageSize);


  const data = await Promise.all(
    pageRows.map(async (e) =>
      toObj(e, await managerNameOf(e.managerId))
    )
  );

  return {
    data,
    total,
    page,
    pageSize,
  };
}

// async function findById(id) {
//   const e = store.employees.find((x) => x.id === id);
//   if (!e) return null;
//   return toObj(e, managerNameOf(e.managerId));
// }

async function findById(id) {
  const [e] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, id));

  if (!e) return null;

  const managerName = await managerNameOf(e.managerId);

  return toObj(e, managerName);
}

// async function findByEmail(email) {
//   const target = email?.toLowerCase();
//   const e = store.employees.find((x) => x.email.toLowerCase() === target);
//   if (!e) return null;
//   return toObj(e, managerNameOf(e.managerId));
// }

async function findByEmail(email) {
  const target = email?.toLowerCase();

  const [e] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.email, target));

  if (!e) return null;

  return toObj(e, await managerNameOf(e.managerId));
}

// async function findByEmployeeId(employeeId) {
//   const e = store.employees.find((x) => x.employeeId === employeeId);
//   if (!e) return null;
//   return toObj(e, managerNameOf(e.managerId));
// }


async function findByEmployeeId(employeeId) {

  const [e] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employeeId, employeeId));

  if (!e) return null;

  return toObj(e, await managerNameOf(e.managerId));
}

async function create(data) {
  const now = new Date();
  const e = {
  id: crypto.randomUUID(),
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

  await db.insert(employeesTable).values(e);

  return findById(e.id);
  // store.employees.push(e);
  // return findById(e.id);
}

async function update(id, data) {
  const existing = await findById(id);

  if (!existing) return null;

  const updates = {};

  if (data.employeeId != null)
    updates.employeeId = data.employeeId.toString();

  if (data.name != null)
    updates.name = data.name.toString();

  if (data.email != null)
    updates.email = data.email.toString();

  if (data.department != null)
    updates.department = data.department.toString();

  if (data.designation != null)
    updates.designation = data.designation.toString();

  if (data.role != null && VALID_ROLES.includes(data.role))
    updates.role = data.role;

  if (data.status != null && VALID_STATUSES.includes(data.status))
    updates.status = data.status;

  if ("managerId" in data)
    updates.managerId = data.managerId ?? null;

  updates.updatedAt = new Date();

  await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, id));

  return findById(id);
}

// async function deleteEmployee(id) {
//   const e = store.employees.find((x) => x.id === id);
//   if (!e) return false;
//   e.status = "Inactive";
//   e.updatedAt = new Date().toISOString();
//   return true;
// }

async function deleteEmployee(id) {
  const employee = await findById(id);

  if (!employee) return false;

  await db
    .update(employeesTable)
    .set({
      status: "Inactive",
      updatedAt: new Date(),
    })
    .where(eq(employeesTable.id, id));

  return true;
}



// async function bulkCreate(rows) {
//   const success = [];
//   const errors = [];

//   for (let i = 0; i < rows.length; i++) {
//     const row = rows[i];
//     try {
//       const empId = row.employeeId?.toString() ?? "";
//       const name = row.name?.toString() ?? "";
//       const email = row.email?.toString() ?? "";
//       const role = row.role;
//       const status = row.status;

//       if (!empId) throw new Error("Missing Employee ID");
//       if (!name) throw new Error("Missing Name");
//       if (!email) throw new Error("Missing Email");
//       if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role: ${role}`);
//       if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);

//       if (store.employees.some((e) => e.employeeId === empId)) throw new Error(`Duplicate Employee ID: ${empId}`);
//       if (store.employees.some((e) => e.email === email)) throw new Error(`Duplicate Email: ${email}`);

//       let resolvedManagerId = null;
//       if (row.managerId) {
//         const mgr = store.employees.find((e) => e.employeeId === row.managerId.toString());
//         if (!mgr) throw new Error(`Manager not found: ${row.managerId}`);
//         resolvedManagerId = mgr.id;
//       }

//       row.managerId = resolvedManagerId;
//       const created = await create(row);
//       success.push(created);
//     } catch (err) {
//       errors.push({ row: i + 1, field: "unknown", message: err.message });
//     }
//   }

//   return { success, errors };
// }


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
      if (!VALID_ROLES.includes(role)) {
        throw new Error(`Invalid role: ${role}`);
      }
      if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      // Check duplicate employeeId
      const existingEmployee = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.employeeId, empId));

      if (existingEmployee.length > 0) {
        throw new Error(`Duplicate Employee ID: ${empId}`);
      }

      // Check duplicate email
      const existingEmail = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.email, email));

      if (existingEmail.length > 0) {
        throw new Error(`Duplicate Email: ${email}`);
      }

      let resolvedManagerId = null;

      if (row.managerId) {
        const manager = await db
          .select()
          .from(employeesTable)
          .where(eq(
            employeesTable.employeeId,
            row.managerId.toString()
          ));

        if (manager.length === 0) {
          throw new Error(`Manager not found: ${row.managerId}`);
        }

        resolvedManagerId = manager[0].id;
      }

      const now = new Date();

      const inserted = await db
        .insert(employeesTable)
        .values({
          id: randomUUID(),
          employeeId: empId,
          name,
          email,
          department: row.department?.toString() ?? "",
          designation: row.designation?.toString() ?? "",
          role,
          managerId: resolvedManagerId,
          status,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      success.push(toObj(inserted[0]));
      
    } catch (err) {
      errors.push({
        row: i + 1,
        field: "unknown",
        message: err.message,
      });
    }
  }

  return { success, errors };
}

// async function getProfile(id) {
//   const employee = await findById(id);
//   if (!employee) return null;

//   const ts = store.timesheets.filter((t) => t.employeeId === id);
//   const totalSubmitted = ts.length;
//   const approved = ts.filter((t) => t.status === "Approved").length;
//   const pending = ts.filter((t) => t.status === "Draft" || t.status === "Submitted").length;
//   const rejected = ts.filter((t) => t.status === "Rejected").length;
//   const approvalRate = totalSubmitted > 0 ? Math.round((approved / totalSubmitted) * 100) : 0;

//   return { employee, metrics: { totalSubmitted, approved, pending, rejected, approvalRate } };
// }

async function getProfile(id) {
  const employee = await findById(id);
  if (!employee) return null;

  const ts = await db
    .select()
    .from(timesheetsTable)
    .where(eq(timesheetsTable.employeeId, id));

  const totalSubmitted = ts.length;
  const approved = ts.filter((t) => t.status === "Approved").length;
  const pending = ts.filter(
    (t) => t.status === "Draft" || t.status === "Submitted"
  ).length;
  const rejected = ts.filter((t) => t.status === "Rejected").length;

  const approvalRate =
    totalSubmitted > 0
      ? Math.round((approved / totalSubmitted) * 100)
      : 0;

  return {
    employee,
    metrics: {
      totalSubmitted,
      approved,
      pending,
      rejected,
      approvalRate,
    },
  };
}

async function getDirectReports(managerId) {
  const manager = await findById(managerId);
  if (!manager) return null;

  // const reports = store.employees.filter((e) => e.managerId === managerId);

  const reports = await db
  .select()
  .from(employeesTable)
  .where(eq(employeesTable.managerId, managerId));

  // const directReports = reports.map((emp) => {
  //   // const ts = store.timesheets.filter((t) => t.employeeId === emp.id);
  //   const ts = await db
  // .select()
  // .from(timesheetsTable)
  // .where(eq(timesheetsTable.employeeId, emp.id));


  //   const submitted = ts.filter((t) => ["Submitted", "Approved", "Rejected"].includes(t.status)).length;
  //   const approved = ts.filter((t) => t.status === "Approved").length;
  //   const rejected = ts.filter((t) => t.status === "Rejected").length;
  //   return {
  //     employee: toObj(emp, manager.name),
  //     submitted,
  //     approved,
  //     rejected,
  //   };
  // });

  const directReports = await Promise.all(
  reports.map(async (emp) => {
    const ts = await db
      .select()
      .from(timesheetsTable)
      .where(eq(timesheetsTable.employeeId, emp.id));

    const submitted = ts.filter(
      (t) => ["Submitted", "Approved", "Rejected"].includes(t.status)
    ).length;

    const approved = ts.filter(
      (t) => t.status === "Approved"
    ).length;

    const rejected = ts.filter(
      (t) => t.status === "Rejected"
    ).length;

    return {
      employee: toObj(emp, manager.name),
      submitted,
      approved,
      rejected,
    };
  })
);

  const reportIds = new Set(reports.map((e) => e.id));
  // const teamTs = store.timesheets.filter((t) => reportIds.has(t.employeeId));
  const teamTs = await db
  .select()
  .from(timesheetsTable)
  .where(inArray(timesheetsTable.employeeId, [...reportIds]));
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
