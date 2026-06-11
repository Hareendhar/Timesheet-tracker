import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { IAuditRepository } from "../interfaces.js";

export class PostgresAuditRepository implements IAuditRepository {
  async findAll(params: { page?: number; pageSize?: number; userId?: string; action?: string; role?: string; dateFrom?: string; dateTo?: string }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (params.userId) conditions.push(eq(auditLogsTable.userId, params.userId));
    if (params.action) conditions.push(eq(auditLogsTable.action, params.action));
    if (params.role) conditions.push(eq(auditLogsTable.role, params.role));
    if (params.dateFrom) conditions.push(gte(auditLogsTable.createdAt, new Date(params.dateFrom)));
    if (params.dateTo) conditions.push(lte(auditLogsTable.createdAt, new Date(params.dateTo)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, countResult] = await Promise.all([
      db.select().from(auditLogsTable).where(where).limit(pageSize).offset(offset).orderBy(sql`${auditLogsTable.createdAt} DESC`),
      db.select({ count: sql<number>`count(*)` }).from(auditLogsTable).where(where),
    ]);
    return { data: rows, total: Number(countResult[0].count), page, pageSize };
  }

  async create(data: any) {
    const id = generateId();
    const now = new Date();
    await db.insert(auditLogsTable).values({ ...data, id, createdAt: now });
    return id;
  }

  async findAll_export(params: { dateFrom?: string; dateTo?: string }) {
    const conditions = [];
    if (params.dateFrom) conditions.push(gte(auditLogsTable.createdAt, new Date(params.dateFrom)));
    if (params.dateTo) conditions.push(lte(auditLogsTable.createdAt, new Date(params.dateTo)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(auditLogsTable).where(where).orderBy(sql`${auditLogsTable.createdAt} DESC`);
  }
}
