import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityStatusEnum = pgEnum("activity_status", ["Active", "Inactive"]);

export const activitiesTable = pgTable("activities", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  status: activityStatusEnum("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

