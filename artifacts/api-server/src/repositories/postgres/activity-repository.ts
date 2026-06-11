import { db } from "@workspace/db";
import { activitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { IActivityRepository } from "../interfaces.js";

export class PostgresActivityRepository implements IActivityRepository {
  async findAll() {
    return db.select().from(activitiesTable).orderBy(activitiesTable.name);
  }

  async findById(id: string) {
    const rows = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id));
    return rows[0] ?? null;
  }

  async create(data: any) {
    const id = generateId();
    const now = new Date();
    await db.insert(activitiesTable).values({ ...data, id, createdAt: now });
    return this.findById(id);
  }

  async update(id: string, data: any) {
    await db.update(activitiesTable).set(data).where(eq(activitiesTable.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await db.delete(activitiesTable).where(eq(activitiesTable.id, id));
    return true;
  }
}
