import { db } from "@workspace/db";
import { projectsTable, clientsTable } from "@workspace/db";
import { eq, and, ilike, sql, or } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { IProjectRepository } from "../interfaces.js";

export class PostgresProjectRepository implements IProjectRepository {
  async findAll(params: { page?: number; pageSize?: number; status?: string; clientId?: string; search?: string }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (params.status) conditions.push(eq(projectsTable.status, params.status as any));
    if (params.clientId) conditions.push(eq(projectsTable.clientId, params.clientId));
    if (params.search) conditions.push(or(ilike(projectsTable.name, `%${params.search}%`), ilike(projectsTable.projectCode, `%${params.search}%`)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, countResult] = await Promise.all([
      db.select().from(projectsTable).where(where).limit(pageSize).offset(offset).orderBy(projectsTable.name),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(where),
    ]);
    const enriched = await Promise.all(rows.map(async (p) => {
      const client = await db.select().from(clientsTable).where(eq(clientsTable.id, p.clientId));
      return { ...p, clientName: client[0]?.name ?? null };
    }));
    return { data: enriched, total: Number(countResult[0].count), page, pageSize };
  }

  async findById(id: string) {
    const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!rows[0]) return null;
    const client = await db.select().from(clientsTable).where(eq(clientsTable.id, rows[0].clientId));
    return { ...rows[0], clientName: client[0]?.name ?? null };
  }

  async create(data: any) {
    const id = generateId();
    const now = new Date();
    await db.insert(projectsTable).values({ ...data, id, createdAt: now, updatedAt: now });
    return this.findById(id);
  }

  async update(id: string, data: any) {
    await db.update(projectsTable).set({ ...data, updatedAt: new Date() }).where(eq(projectsTable.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    return true;
  }
}
