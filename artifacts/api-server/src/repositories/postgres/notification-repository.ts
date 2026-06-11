import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { INotificationRepository } from "../interfaces.js";

export class PostgresNotificationRepository implements INotificationRepository {
  async findAll(params: { userId: string; unreadOnly?: boolean; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions = [eq(notificationsTable.userId, params.userId)];
    if (params.unreadOnly) conditions.push(eq(notificationsTable.isRead, false));
    const where = and(...conditions);
    const [rows, countResult, unreadResult] = await Promise.all([
      db.select().from(notificationsTable).where(where).limit(pageSize).offset(offset).orderBy(sql`${notificationsTable.createdAt} DESC`),
      db.select({ count: sql<number>`count(*)` }).from(notificationsTable).where(where),
      db.select({ count: sql<number>`count(*)` }).from(notificationsTable).where(and(eq(notificationsTable.userId, params.userId), eq(notificationsTable.isRead, false))),
    ]);
    return { data: rows, total: Number(countResult[0].count), unreadCount: Number(unreadResult[0].count), page, pageSize };
  }

  async create(data: any) {
    const id = generateId();
    const now = new Date();
    await db.insert(notificationsTable).values({ ...data, id, createdAt: now });
    return id;
  }

  async markRead(id: string, userId: string) {
    await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    return true;
  }

  async markAllRead(userId: string) {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
  }
}
