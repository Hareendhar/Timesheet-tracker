const { store } = require("../data/store");
const { newId } = require("../lib/id");

const VALID_STATUSES = ["Active", "Inactive"];

function clientNameOf(clientId) {
  return store.clients.find((c) => c.id === clientId)?.name ?? null;
}

function toObj(p, clientName) {
  return {
    id: p.id,
    projectCode: p.projectCode,
    name: p.name,
    clientId: p.clientId,
    clientName: clientName ?? null,
    clientManagerName: p.clientManagerName ?? null,
    clientManagerEmail: p.clientManagerEmail ?? null,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function findAll(page, pageSize, status, clientId, search) {
  let rows = store.projects;
  if (status) rows = rows.filter((p) => p.status === status);
  if (clientId) rows = rows.filter((p) => p.clientId === clientId);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.projectCode.toLowerCase().includes(q));
  }

  rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  const data = rows.slice(offset, offset + pageSize).map((p) => toObj(p, clientNameOf(p.clientId)));
  return { data, total, page, pageSize };
}

async function findById(id) {
  const p = store.projects.find((x) => x.id === id);
  if (!p) return null;
  return toObj(p, clientNameOf(p.clientId));
}

async function create(data) {
  const now = new Date().toISOString();
  const p = {
    id: newId(),
    projectCode: data.projectCode?.toString() ?? "",
    name: data.name?.toString() ?? "",
    clientId: data.clientId?.toString() ?? "",
    clientManagerName: data.clientManagerName ? data.clientManagerName.toString() : null,
    clientManagerEmail: data.clientManagerEmail ? data.clientManagerEmail.toString() : null,
    status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
    createdAt: now,
    updatedAt: now,
  };
  store.projects.push(p);
  return findById(p.id);
}

async function update(id, data) {
  const p = store.projects.find((x) => x.id === id);
  if (!p) return null;
  if (data.projectCode != null) p.projectCode = data.projectCode.toString();
  if (data.name != null) p.name = data.name.toString();
  if (data.clientId != null) p.clientId = data.clientId.toString();
  if ("clientManagerName" in data) p.clientManagerName = data.clientManagerName ?? null;
  if ("clientManagerEmail" in data) p.clientManagerEmail = data.clientManagerEmail ?? null;
  if (data.status != null && VALID_STATUSES.includes(data.status)) p.status = data.status;
  p.updatedAt = new Date().toISOString();
  return findById(id);
}

async function deleteProject(id) {
  const idx = store.projects.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  store.projects.splice(idx, 1);
  return true;
}

module.exports = { findAll, findById, create, update, delete: deleteProject };
