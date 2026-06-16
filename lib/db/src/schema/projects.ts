import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectStatusEnum = pgEnum("project_status", ["Active", "Inactive"]);

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  projectCode: text("project_code").notNull().unique(),
  name: text("name").notNull(),
  clientId: text("client_id").notNull(),
  clientManagerName: text("client_manager_name"),
  clientManagerEmail: text("client_manager_email"),
  status: projectStatusEnum("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
