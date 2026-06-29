const { store } = require("../data/store");
const { newId } = require("../lib/id");

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

async function findAll(page, pageSize, userId, action, role, dateFrom, dateTo) {
  let rows = store.auditLogs;
  if (userId) rows = rows.filter((a) => a.userId === userId);
  if (action) rows = rows.filter((a) => a.action === action);
  if (role) rows = rows.filter((a) => a.role === role);
  if (dateFrom) {
    const df = new Date(dateFrom);
    rows = rows.filter((a) => new Date(a.createdAt) >= df);
  }
  if (dateTo) {
    const dt = new Date(dateTo);
    rows = rows.filter((a) => new Date(a.createdAt) <= dt);
  }

  const total = rows.length;
  const sorted = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const offset = (page - 1) * pageSize;
  return { data: sorted.slice(offset, offset + pageSize).map(toObj), total, page, pageSize };
}

async function create(data) {
  const log = {
    id: newId(),
    userId: data.userId?.toString() ?? "",
    userName: data.userName ? data.userName.toString() : null,
    role: data.role?.toString() ?? "",
    action: data.action?.toString() ?? "",
    entityType: data.entityType?.toString() ?? "",
    entityId: data.entityId ? data.entityId.toString() : null,
    oldValue: data.oldValue ?? null,
    newValue: data.newValue ?? null,
    ipAddress: data.ipAddress ?? null,
    createdAt: new Date().toISOString(),
  };
  store.auditLogs.push(log);
  return log.id;
}

async function findAllExport(dateFrom, dateTo) {
  let rows = store.auditLogs;
  if (dateFrom) {
    const df = new Date(dateFrom);
    rows = rows.filter((a) => new Date(a.createdAt) >= df);
  }
  if (dateTo) {
    const dt = new Date(dateTo);
    rows = rows.filter((a) => new Date(a.createdAt) <= dt);
  }
  return [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(toObj);
}

module.exports = { findAll, create, findAllExport };
