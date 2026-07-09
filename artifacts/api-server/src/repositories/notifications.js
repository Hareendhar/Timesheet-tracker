const { db, notificationsTable } = require("@workspace/db");
const {eq,and,desc,sql,} = require("drizzle-orm");
const crypto = require("crypto");

function toObj(n) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    relatedId: n.relatedId ?? null,
    createdAt: n.createdAt?.toISOString?.() ?? n.createdAt,
  };
}

async function findAll(userId, unreadOnly, page, pageSize) {
  const conditions = [eq(notificationsTable.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(notificationsTable.isRead, false));
  }

  const whereClause = and(...conditions);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(whereClause)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({
      count: sql`count(*)`,
    })
    .from(notificationsTable)
    .where(whereClause);

  const [{ unreadCount }] = await db
    .select({
      unreadCount: sql`count(*)`,
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false)
      )
    );

  return {
    data: rows.map(toObj),
    total: Number(count),
    page,
    pageSize,
    unreadCount: Number(unreadCount),
  };
}

async function create(data) {
  const id = crypto.randomUUID();

  await db.insert(notificationsTable).values({
    id,
    userId: data.userId?.toString() ?? "",
    type: data.type?.toString() ?? "",
    title: data.title?.toString() ?? "",
    message: data.message?.toString() ?? "",
    isRead: typeof data.isRead === "boolean" ? data.isRead : false,
    relatedId: data.relatedId ?? null,
  });

  return id;
}



async function markRead(id, userId) {
  const result = await db
    .update(notificationsTable)
    .set({
      isRead: true,
    })
    .where(
      and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, userId)
      )
    )
    .returning({
      id: notificationsTable.id,
    });

  return result.length > 0;
}

async function markAllRead(userId) {
  await db
    .update(notificationsTable)
    .set({
      isRead: true,
    })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false)
      )
    );
}

module.exports = {
  findAll,
  create,
  markRead,
  markAllRead,
};

















// const { store } = require("../data/store");
// const { newId } = require("../lib/id");

// function toObj(n) {
//   return {
//     id: n.id,
//     userId: n.userId,
//     type: n.type,
//     title: n.title,
//     message: n.message,
//     isRead: n.isRead,
//     relatedId: n.relatedId ?? null,
//     createdAt: n.createdAt,
//   };
// }

// async function findAll(userId, unreadOnly, page, pageSize) {
//   let rows = store.notifications.filter((n) => n.userId === userId);
//   if (unreadOnly) rows = rows.filter((n) => !n.isRead);

//   const total = rows.length;
//   const sorted = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//   const offset = (page - 1) * pageSize;
//   const data = sorted.slice(offset, offset + pageSize).map(toObj);

//   const unreadCount = store.notifications.filter((n) => n.userId === userId && !n.isRead).length;

//   return { data, total, page, pageSize, unreadCount };
// }

// async function create(data) {
//   const n = {
//     id: newId(),
//     userId: data.userId?.toString() ?? "",
//     type: data.type?.toString() ?? "",
//     title: data.title?.toString() ?? "",
//     message: data.message?.toString() ?? "",
//     isRead: typeof data.isRead === "boolean" ? data.isRead : false,
//     relatedId: data.relatedId ?? null,
//     createdAt: new Date().toISOString(),
//   };
//   store.notifications.push(n);
//   return n.id;
// }

// async function markRead(id, userId) {
//   const n = store.notifications.find((x) => x.id === id && x.userId === userId);
//   if (!n) return false;
//   n.isRead = true;
//   return true;
// }

// async function markAllRead(userId) {
//   for (const n of store.notifications) {
//     if (n.userId === userId && !n.isRead) n.isRead = true;
//   }
// }

// module.exports = { findAll, create, markRead, markAllRead };
