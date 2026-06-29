const { store } = require("../data/store");
const { newId } = require("../lib/id");

const VALID_STATUSES = ["Active", "Inactive"];

function toObj(c) {
  return {
    id: c.id,
    clientCode: c.clientCode,
    name: c.name,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function findAll(page, pageSize, status, search) {
  let rows = store.clients;
  if (status) rows = rows.filter((c) => c.status === status);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.clientCode.toLowerCase().includes(q));
  }

  rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  return { data: rows.slice(offset, offset + pageSize).map(toObj), total, page, pageSize };
}

async function findById(id) {
  const c = store.clients.find((x) => x.id === id);
  return c ? toObj(c) : null;
}

async function create(data) {
  const now = new Date().toISOString();
  const c = {
    id: newId(),
    clientCode: data.clientCode?.toString() ?? "",
    name: data.name?.toString() ?? "",
    status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
    createdAt: now,
    updatedAt: now,
  };
  store.clients.push(c);
  return findById(c.id);
}

async function update(id, data) {
  const c = store.clients.find((x) => x.id === id);
  if (!c) return null;
  if (data.clientCode != null) c.clientCode = data.clientCode.toString();
  if (data.name != null) c.name = data.name.toString();
  if (data.status != null && VALID_STATUSES.includes(data.status)) c.status = data.status;
  c.updatedAt = new Date().toISOString();
  return findById(id);
}

async function deleteClient(id) {
  const idx = store.clients.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  store.clients.splice(idx, 1);
  return true;
}

module.exports = { findAll, findById, create, update, delete: deleteClient };
