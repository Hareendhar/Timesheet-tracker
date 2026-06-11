import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db";
import { eq, and, ilike, sql, or } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { IClientRepository } from "../interfaces.js";

export class PostgresClientRepository implements IClientRepository {
  async findAll(params: { page?: number; pageSize?: number; status?: string; search?: string }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (params.status) conditions.push(eq(clientsTable.status, params.status as any));
    if (params.search) conditions.push(or(ilike(clientsTable.name, `%${params.search}%`), ilike(clientsTable.clientCode, `%${params.search}%`)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, countResult] = await Promise.all([
      db.select().from(clientsTable).where(where).limit(pageSize).offset(offset).orderBy(clientsTable.name),
      db.select({ count: sql<number>`count(*)` }).from(clientsTable).where(where),
    ]);
    return { data: rows, total: Number(countResult[0].count), page, pageSize };
  }

  async findById(id: string) {
    const rows = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    return rows[0] ?? null;
  }

  async create(data: any) {
    const id = generateId();
    const now = new Date();
    await db.insert(clientsTable).values({ ...data, id, createdAt: now, updatedAt: now });
    return this.findById(id);
  }

  async update(id: string, data: any) {
    await db.update(clientsTable).set({ ...data, updatedAt: new Date() }).where(eq(clientsTable.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    return true;
  }
}
