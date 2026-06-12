import { pgTable, text, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timesheetStatusEnum = pgEnum("timesheet_status", ["Draft", "Submitted", "Approved", "Rejected"]);

export const timesheetsTable = pgTable("timesheets", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  weekStartDate: text("week_start_date").notNull(),
  weekEndDate: text("week_end_date").notNull(),
  status: timesheetStatusEnum("status").notNull().default("Draft"),
  totalHours: real("total_hours").notNull().default(0),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  rejectionComment: text("rejection_comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const timesheetRowsTable = pgTable("timesheet_rows", {
  id: text("id").primaryKey(),
  timesheetId: text("timesheet_id").notNull(),
  projectId: text("project_id").notNull(),
  activityId: text("activity_id").notNull(),
  monday: real("monday").notNull().default(0),
  tuesday: real("tuesday").notNull().default(0),
  wednesday: real("wednesday").notNull().default(0),
  thursday: real("thursday").notNull().default(0),
  friday: real("friday").notNull().default(0),
  saturday: real("saturday").notNull().default(0),
  sunday: real("sunday").notNull().default(0),
  totalHours: real("total_hours").notNull().default(0),
  comments: text("comments"),
  mondayStart: text("monday_start"),
  mondayEnd: text("monday_end"),
  tuesdayStart: text("tuesday_start"),
  tuesdayEnd: text("tuesday_end"),
  wednesdayStart: text("wednesday_start"),
  wednesdayEnd: text("wednesday_end"),
  thursdayStart: text("thursday_start"),
  thursdayEnd: text("thursday_end"),
  fridayStart: text("friday_start"),
  fridayEnd: text("friday_end"),
  saturdayStart: text("saturday_start"),
  saturdayEnd: text("saturday_end"),
  sundayStart: text("sunday_start"),
  sundayEnd: text("sunday_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTimesheetSchema = createInsertSchema(timesheetsTable).omit({ createdAt: true, updatedAt: true });
export const insertTimesheetRowSchema = createInsertSchema(timesheetRowsTable).omit({ createdAt: true });
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type InsertTimesheetRow = z.infer<typeof insertTimesheetRowSchema>;
export type Timesheet = typeof timesheetsTable.$inferSelect;
export type TimesheetRow = typeof timesheetRowsTable.$inferSelect;
