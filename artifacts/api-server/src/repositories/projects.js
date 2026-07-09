// const { store } = require("../data/store");
// const { newId } = require("../lib/id");


const {db,projectsTable,clientsTable,} = require("@workspace/db");

const {eq,and,ilike,asc,sql,} = require("drizzle-orm");

const crypto = require("crypto");

const VALID_STATUSES = ["Active", "Inactive"];

// function clientNameOf(clientId) {
//   return store.clients.find((c) => c.id === clientId)?.name ?? null;
// }

// function toObj(p, clientName) {
//   return {
//     id: p.id,
//     projectCode: p.projectCode,
//     name: p.name,
//     clientId: p.clientId,
//     clientName: clientName ?? null,
//     clientManagerName: p.clientManagerName ?? null,
//     clientManagerEmail: p.clientManagerEmail ?? null,
//     status: p.status,
//     createdAt: p.createdAt,
//     updatedAt: p.updatedAt,
//   };
// }

function toObj(row) {
  return {
    id: row.id,
    projectCode: row.projectCode,
    name: row.name,
    clientId: row.clientId,
    clientName: row.clientName ?? null,
    clientManagerName: row.clientManagerName,
    clientManagerEmail: row.clientManagerEmail,
    status: row.status,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

// async function findAll(page, pageSize, status, clientId, search) {
//   let rows = store.projects;
//   if (status) rows = rows.filter((p) => p.status === status);
//   if (clientId) rows = rows.filter((p) => p.clientId === clientId);
//   if (search) {
//     const q = search.toLowerCase();
//     rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.projectCode.toLowerCase().includes(q));
//   }

//   rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
//   const total = rows.length;
//   const offset = (page - 1) * pageSize;
//   const data = rows.slice(offset, offset + pageSize).map((p) => toObj(p, clientNameOf(p.clientId)));
//   return { data, total, page, pageSize };
// }

async function findAll(page, pageSize, status, clientId, search) {
  const conditions = [];

  if (status) {
    conditions.push(eq(projectsTable.status, status));
  }

  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId));
  }

  if (search) {
    conditions.push(ilike(projectsTable.name, `%${search}%`));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: projectsTable.id,
      projectCode: projectsTable.projectCode,
      name: projectsTable.name,
      clientId: projectsTable.clientId,
      clientName: clientsTable.name,
      clientManagerName: projectsTable.clientManagerName,
      clientManagerEmail: projectsTable.clientManagerEmail,
      status: projectsTable.status,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(
      clientsTable,
      eq(projectsTable.clientId, clientsTable.id)
    )
    .where(whereClause)
    .orderBy(asc(projectsTable.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({
      count: sql`count(*)`,
    })
    .from(projectsTable)
    .where(whereClause);

  return {
    data: rows.map((r) => toObj(r)),
    total: Number(count),
    page,
    pageSize,
  };
}

// async function findById(id) {
//   const p = store.projects.find((x) => x.id === id);
//   if (!p) return null;
//   return toObj(p, clientNameOf(p.clientId));
// }

async function findById(id) {
  const [row] = await db
    .select({
      id: projectsTable.id,
      projectCode: projectsTable.projectCode,
      name: projectsTable.name,
      clientId: projectsTable.clientId,
      clientName: clientsTable.name,
      clientManagerName: projectsTable.clientManagerName,
      clientManagerEmail: projectsTable.clientManagerEmail,
      status: projectsTable.status,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(
      clientsTable,
      eq(projectsTable.clientId, clientsTable.id)
    )
    .where(eq(projectsTable.id, id));

  return row ? toObj(row) : null;
}

// async function create(data) {
//   const now = new Date().toISOString();
//   const p = {
//     id: newId(),
//     projectCode: data.projectCode?.toString() ?? "",
//     name: data.name?.toString() ?? "",
//     clientId: data.clientId?.toString() ?? "",
//     clientManagerName: data.clientManagerName ? data.clientManagerName.toString() : null,
//     clientManagerEmail: data.clientManagerEmail ? data.clientManagerEmail.toString() : null,
//     status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
//     createdAt: now,
//     updatedAt: now,
//   };
//   store.projects.push(p);
//   return findById(p.id);
// }

async function create(data) {
  const id = crypto.randomUUID();

  await db.insert(projectsTable).values({
    id,
    projectCode: data.projectCode,
    name: data.name,
    clientId: data.clientId,
    clientManagerName: data.clientManagerName ?? null,
    clientManagerEmail: data.clientManagerEmail ?? null,
    status: VALID_STATUSES.includes(data.status)
      ? data.status
      : "Active",
  });

  return findById(id);
}

// async function update(id, data) {
//   const p = store.projects.find((x) => x.id === id);
//   if (!p) return null;
//   if (data.projectCode != null) p.projectCode = data.projectCode.toString();
//   if (data.name != null) p.name = data.name.toString();
//   if (data.clientId != null) p.clientId = data.clientId.toString();
//   if ("clientManagerName" in data) p.clientManagerName = data.clientManagerName ?? null;
//   if ("clientManagerEmail" in data) p.clientManagerEmail = data.clientManagerEmail ?? null;
//   if (data.status != null && VALID_STATUSES.includes(data.status)) p.status = data.status;
//   p.updatedAt = new Date().toISOString();
//   return findById(id);
// }

async function update(id, data) {
  await db
    .update(projectsTable)
    .set({
      ...(data.projectCode != null && {
        projectCode: data.projectCode,
      }),
      ...(data.name != null && {
        name: data.name,
      }),
      ...(data.clientId != null && {
        clientId: data.clientId,
      }),
      ...("clientManagerName" in data && {
        clientManagerName: data.clientManagerName,
      }),
      ...("clientManagerEmail" in data && {
        clientManagerEmail: data.clientManagerEmail,
      }),
      ...(data.status != null &&
        VALID_STATUSES.includes(data.status) && {
          status: data.status,
        }),
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id));

  return findById(id);
}

// async function deleteProject(id) {
//   const idx = store.projects.findIndex((x) => x.id === id);
//   if (idx === -1) return false;
//   store.projects.splice(idx, 1);
//   return true;
// }

async function deleteProject(id) {
  const result = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, id));

  return result.rowCount > 0;
}

module.exports = { findAll, findById, create, update, delete: deleteProject };
