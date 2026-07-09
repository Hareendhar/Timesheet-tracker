// const { store } = require("../data/store");
// const { newId } = require("../lib/id");

const { db, auditLogsTable } = require("@workspace/db");
const {eq,and,gte,lte,desc,} = require("drizzle-orm");
const crypto = require("crypto");

function toObj(a) {
  return {
    id: a.id,
    userId: a.userId,
    userName: a.userName ?? null,
    role: a.role,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId ?? null,
    oldValue: a.oldValue ?? null,
    newValue: a.newValue ?? null,
    ipAddress: a.ipAddress ?? null,
    createdAt: a.createdAt,
  };
}

// async function findAll(page, pageSize, userId, action, role, dateFrom, dateTo) {
//   let rows = store.auditLogs;
//   if (userId) rows = rows.filter((a) => a.userId === userId);
//   if (action) rows = rows.filter((a) => a.action === action);
//   if (role) rows = rows.filter((a) => a.role === role);
//   if (dateFrom) {
//     const df = new Date(dateFrom);
//     rows = rows.filter((a) => new Date(a.createdAt) >= df);
//   }
//   if (dateTo) {
//     const dt = new Date(dateTo);
//     rows = rows.filter((a) => new Date(a.createdAt) <= dt);
//   }

//   const total = rows.length;
//   const sorted = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//   const offset = (page - 1) * pageSize;
//   return { data: sorted.slice(offset, offset + pageSize).map(toObj), total, page, pageSize };
// }

async function findAll(page, pageSize, userId, action, role, dateFrom, dateTo) {
  const conditions = [];

  if (userId) conditions.push(eq(auditLogsTable.userId, userId));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (role) conditions.push(eq(auditLogsTable.role, role));
  if (dateFrom) conditions.push(gte(auditLogsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(auditLogsTable.createdAt, new Date(dateTo)));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(where)
    .orderBy(desc(auditLogsTable.createdAt));

  const total = rows.length;
  const offset = (page - 1) * pageSize;

  return {
    data: rows.slice(offset, offset + pageSize).map(toObj),
    total,
    page,
    pageSize,
  };
}

// async function create(data) {
//   const log = {
//     id: newId(),
//     userId: data.userId?.toString() ?? "",
//     userName: data.userName ? data.userName.toString() : null,
//     role: data.role?.toString() ?? "",
//     action: data.action?.toString() ?? "",
//     entityType: data.entityType?.toString() ?? "",
//     entityId: data.entityId ? data.entityId.toString() : null,
//     oldValue: data.oldValue ?? null,
//     newValue: data.newValue ?? null,
//     ipAddress: data.ipAddress ?? null,
//     createdAt: new Date().toISOString(),
//   };
//   store.auditLogs.push(log);
//   return log.id;
// }


// async function create(data) {
//   const log = {
//     id: crypto.randomUUID(),
//     userId: data.userId?.toString() ?? "",
//     userName: data.userName ?? null,
//     role: data.role?.toString() ?? "",
//     action: data.action?.toString() ?? "",
//     entityType: data.entityType?.toString() ?? "",
//     entityId: data.entityId ?? null,
//     oldValue: data.oldValue ?? null,
//     newValue: data.newValue ?? null,
//     ipAddress: data.ipAddress ?? null,
//   };

//   await db.insert(auditLogsTable).values(log);

//   return log.id;
// }
async function create(data) {
  const log = {
    id: crypto.randomUUID(),
    userId: data.userId?.toString() ?? "",
    userName: data.userName ?? null,
    role: data.role?.toString() ?? "",
    action: data.action?.toString() ?? "",
    entityType: data.entityType?.toString() ?? "",
    entityId: data.entityId ?? null,
    oldValue: data.oldValue ?? null,
    newValue: data.newValue ?? null,
    ipAddress: data.ipAddress ?? null,
  };

  console.log("Audit create called");
  console.log(log);

  try {
    await db.insert(auditLogsTable).values(log);
    console.log("Audit inserted successfully");
  } catch (err) {
    console.error("Audit insert failed:", err);
  }

  return log.id;
}



// async function findAllExport(dateFrom, dateTo) {
//   let rows = store.auditLogs;
//   if (dateFrom) {
//     const df = new Date(dateFrom);
//     rows = rows.filter((a) => new Date(a.createdAt) >= df);
//   }
//   if (dateTo) {
//     const dt = new Date(dateTo);
//     rows = rows.filter((a) => new Date(a.createdAt) <= dt);
//   }
//   return [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(toObj);
// }

async function findAllExport(dateFrom, dateTo) {
  const conditions = [];

  if (dateFrom)
    conditions.push(gte(auditLogsTable.createdAt, new Date(dateFrom)));

  if (dateTo)
    conditions.push(lte(auditLogsTable.createdAt, new Date(dateTo)));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(where)
    .orderBy(desc(auditLogsTable.createdAt));

  return rows.map(toObj);
}

module.exports = { findAll, create, findAllExport };
