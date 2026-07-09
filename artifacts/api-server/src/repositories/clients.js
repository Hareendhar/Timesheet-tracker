// const { store } = require("../data/store");
// const { newId } = require("../lib/id");

const { db, clientsTable } = require("@workspace/db");
const { eq, ilike, and, asc, sql } = require("drizzle-orm");
const crypto = require("crypto");


const VALID_STATUSES = ["Active", "Inactive"];

// function toObj(c) {
//   return {
//     id: c.id,
//     clientCode: c.clientCode,
//     name: c.name,
//     status: c.status,
//     createdAt: c.createdAt,
//     updatedAt: c.updatedAt,
//   };
// }

function toObj(c) {
  return {
    ...c,
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
    updatedAt: c.updatedAt?.toISOString?.() ?? c.updatedAt,
  };
} 

// async function findAll(page, pageSize, status, search) {
//   let rows = store.clients;
//   if (status) rows = rows.filter((c) => c.status === status);
//   if (search) {
//     const q = search.toLowerCase();
//     rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.clientCode.toLowerCase().includes(q));
//   }

//   rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
//   const total = rows.length;
//   const offset = (page - 1) * pageSize;
//   return { data: rows.slice(offset, offset + pageSize).map(toObj), total, page, pageSize };
// }



async function findAll(page, pageSize, status, search) {
  const conditions = [];

  if (status) {
    conditions.push(eq(clientsTable.status, status));
  }

  if (search) {
    conditions.push(
      ilike(clientsTable.name, `%${search}%`)
    );
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(clientsTable)
    .where(whereClause)
    .orderBy(asc(clientsTable.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(clientsTable)
    .where(whereClause);

  return {
    data: rows.map(toObj),
    total: Number(count),
    page,
    pageSize,
  };
}

// async function findById(id) {
//   const c = store.clients.find((x) => x.id === id);
//   return c ? toObj(c) : null;
// }

async function findById(id) {
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, id));

  return client ? toObj(client) : null;
}

// async function create(data) {
//   const now = new Date().toISOString();
//   const c = {
//     id: newId(),
//     clientCode: data.clientCode?.toString() ?? "",
//     name: data.name?.toString() ?? "",
//     status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
//     createdAt: now,
//     updatedAt: now,
//   };
//   store.clients.push(c);
//   return findById(c.id);
// }
async function create(data) {
  const id = crypto.randomUUID();

  await db.insert(clientsTable).values({
    id,
    clientCode: data.clientCode?.toString() ?? "",
    name: data.name?.toString() ?? "",
    status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return findById(id);
}

// async function update(id, data) {
//   const c = store.clients.find((x) => x.id === id);
//   if (!c) return null;
//   if (data.clientCode != null) c.clientCode = data.clientCode.toString();
//   if (data.name != null) c.name = data.name.toString();
//   if (data.status != null && VALID_STATUSES.includes(data.status)) c.status = data.status;
//   c.updatedAt = new Date().toISOString();
//   return findById(id);
// }

async function update(id, data) {
  const values = {
    updatedAt: new Date(),
  };

  if (data.clientCode != null) {
    values.clientCode = data.clientCode.toString();
  }

  if (data.name != null) {
    values.name = data.name.toString();
  }

  if (data.status != null && VALID_STATUSES.includes(data.status)) {
    values.status = data.status;
  }

  await db
    .update(clientsTable)
    .set(values)
    .where(eq(clientsTable.id, id));

  return findById(id);
}

// async function deleteClient(id) {
//   const idx = store.clients.findIndex((x) => x.id === id);
//   if (idx === -1) return false;
//   store.clients.splice(idx, 1);
//   return true;
// }


async function deleteClient(id) {
  const result = await db
    .delete(clientsTable)
    .where(eq(clientsTable.id, id));

  return result.rowCount > 0;
}

module.exports = { findAll, findById, create, update, delete: deleteClient };
