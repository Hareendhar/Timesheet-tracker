const { db, activitiesTable } = require("@workspace/db");
const { eq, asc } = require("drizzle-orm");
const crypto = require("crypto");

const VALID_STATUSES = ["Active", "Inactive"];

function toObj(a) {
  return {
    id: a.id,
    name: a.name,
    status: a.status,
    createdAt: a.createdAt?.toISOString?.() ?? a.createdAt,
  };
}

async function findAll() {
  const rows = await db
    .select()
    .from(activitiesTable)
    .orderBy(asc(activitiesTable.name));

  return rows.map(toObj);
}

async function findById(id) {
  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, id));

  return activity ? toObj(activity) : null;
}

async function create(data) {
  const id = crypto.randomUUID();

  await db.insert(activitiesTable).values({
    id,
    name: data.name?.toString() ?? "",
    status: VALID_STATUSES.includes(data.status)
      ? data.status
      : "Active",
  });

  return findById(id);
}

async function update(id, data) {
  await db
    .update(activitiesTable)
    .set({
      ...(data.name != null && { name: data.name.toString() }),
      ...(data.status != null &&
        VALID_STATUSES.includes(data.status) && {
          status: data.status,
        }),
    })
    .where(eq(activitiesTable.id, id));

  return findById(id);
}

async function deleteActivity(id) {
  const result = await db
    .delete(activitiesTable)
    .where(eq(activitiesTable.id, id));

  return result.rowCount > 0;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: deleteActivity,
};






















// const { store } = require("../data/store");
// const { newId } = require("../lib/id");

// const VALID_STATUSES = ["Active", "Inactive"];

// function toObj(a) {
//   return { id: a.id, name: a.name, status: a.status, createdAt: a.createdAt };
// }

// async function findAll() {
//   return [...store.activities].sort((a, b) => a.name.localeCompare(b.name)).map(toObj);
// }

// async function findById(id) {
//   const a = store.activities.find((x) => x.id === id);
//   return a ? toObj(a) : null;
// }

// async function create(data) {
//   const a = {
//     id: newId(),
//     name: data.name?.toString() ?? "",
//     status: VALID_STATUSES.includes(data.status) ? data.status : "Active",
//     createdAt: new Date().toISOString(),
//   };
//   store.activities.push(a);
//   return findById(a.id);
// }

// async function update(id, data) {
//   const a = store.activities.find((x) => x.id === id);
//   if (!a) return null;
//   if (data.name != null) a.name = data.name.toString();
//   if (data.status != null && VALID_STATUSES.includes(data.status)) a.status = data.status;
//   return findById(id);
// }

// async function deleteActivity(id) {
//   const idx = store.activities.findIndex((x) => x.id === id);
//   if (idx === -1) return false;
//   store.activities.splice(idx, 1);
//   return true;
// }

// module.exports = { findAll, findById, create, update, delete: deleteActivity };
