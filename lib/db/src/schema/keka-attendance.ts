import { pgTable, text, real, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const kekaAttendanceTable = pgTable(
  "keka_attendance",
  {
    id: text("id").primaryKey(),
    employeeNumber: text("employee_number").notNull(),
    employeeIdentifier: text("employee_identifier"),
    attendanceDate: timestamp("attendance_date").notNull(),
    dayType: integer("day_type"),


    workMode: text("work_mode"),
    attendanceSource: text("attendance_source"),
    attendanceLogSource: integer("attendance_log_source"),
    manualClockinType: integer("manual_clockin_type"),
    premiseName: text("premise_name"),

    shiftStartTime: timestamp("shift_start_time"),
    shiftEndTime: timestamp("shift_end_time"),
    shiftDuration: real("shift_duration"),
    shiftBreakDuration: real("shift_break_duration"),
    shiftEffectiveDuration: real("shift_effective_duration"),

    totalGrossHours: real("total_gross_hours").notNull().default(0),
    totalEffectiveHours: real("total_effective_hours").notNull().default(0),
    totalBreakDuration: real("total_break_duration").notNull().default(0),

    totalEffectiveOvertimeDuration: real("total_effective_overtime_duration").default(0),
    totalGrossOvertimeDuration: real("total_gross_overtime_duration").default(0),

    firstIn: timestamp("first_in"),
    lastOut: timestamp("last_out"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("keka_attendance_employee_date_unique").on(
      table.employeeNumber,
      table.attendanceDate
    ),
  ]
);
