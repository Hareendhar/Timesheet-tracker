import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientStatusEnum = pgEnum("client_status", ["Active", "Inactive"]);

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey(),
  clientCode: text("client_code").notNull().unique(),
  name: text("name").notNull(),
  status: clientStatusEnum("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
