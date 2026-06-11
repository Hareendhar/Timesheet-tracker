import { db } from "@workspace/db";
import { timesheetsTable, timesheetRowsTable, employeesTable, projectsTable, activitiesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { ITimesheetRepository } from "../interfaces.js";

function calcTotal(row: any) {
  return (row.monday || 0) + (row.tuesday || 0) + (row.wednesday || 0) + (row.thursday || 0) + (row.friday || 0) + (row.saturday || 0) + (row.sunday || 0);
}

function weekEndDate(weekStartDate: string) {
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

async function enrichTimesheet(ts: any) {
  const rows = await db.select().from(timesheetRowsTable).where(eq(timesheetRowsTable.timesheetId, ts.id));
  const employee = await db.select().from(employeesTable).where(eq(employeesTable.id, ts.employeeId));
  let approverName = null;
  if (ts.approvedBy) {
    const approver = await db.select().from(employeesTable).where(eq(employeesTable.id, ts.approvedBy));
    approverName = approver[0]?.name ?? null;
  }
  const enrichedRows = await Promise.all(rows.map(async (r) => {
    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, r.projectId));
    const activity = await db.select().from(activitiesTable).where(eq(activitiesTable.id, r.activityId));
    return { ...r, projectName: project[0]?.name ?? null, activityName: activity[0]?.name ?? null };
  }));
  return {
    ...ts,
    employeeName: employee[0]?.name ?? null,
    approverName,
    rows: enrichedRows,
  };
}

export class PostgresTimesheetRepository implements ITimesheetRepository {
  async findAll(params: { page?: number; pageSize?: number; employeeId?: string; status?: string; weekStartDate?: string; managerId?: string }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    let baseQuery = `SELECT t.* FROM timesheets t`;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.managerId) {
      baseQuery += ` JOIN employees e ON t.employee_id = e.id`;
      conditions.push(`e.manager_id = $${idx++}`);
      values.push(params.managerId);
    }
    if (params.employeeId) { conditions.push(`t.employee_id = $${idx++}`); values.push(params.employeeId); }
    if (params.status) { conditions.push(`t.status = $${idx++}`); values.push(params.status); }
    if (params.weekStartDate) { conditions.push(`t.week_start_date = $${idx++}`); values.push(params.weekStartDate); }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM (${baseQuery}${whereClause}) sub`, values));
    const rowsResult = await db.execute(sql.raw(`${baseQuery}${whereClause} ORDER BY t.week_start_date DESC, t.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, values));

    const rows = rowsResult.rows as any[];
    const total = Number((countResult.rows as any[])[0]?.count || 0);
    const enriched = await Promise.all(rows.map(enrichTimesheet));
    return { data: enriched, total, page, pageSize };
  }

  async findById(id: string) {
    const rows = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!rows[0]) return null;
    return enrichTimesheet(rows[0]);
  }

  async findByEmployeeAndWeek(employeeId: string, weekStartDate: string) {
    const rows = await db.select().from(timesheetsTable).where(
      and(eq(timesheetsTable.employeeId, employeeId), eq(timesheetsTable.weekStartDate, weekStartDate))
    );
    if (!rows[0]) return null;
    return enrichTimesheet(rows[0]);
  }

  async create(data: any, rows: any[]) {
    const id = generateId();
    const now = new Date();
    const endDate = weekEndDate(data.weekStartDate);
    let totalHours = 0;

    await db.insert(timesheetsTable).values({
      id, employeeId: data.employeeId, weekStartDate: data.weekStartDate,
      weekEndDate: endDate, status: "Draft", totalHours: 0, createdAt: now, updatedAt: now,
    });

    for (const row of rows) {
      const rowId = generateId();
      const total = calcTotal(row);
      totalHours += total;
      await db.insert(timesheetRowsTable).values({
        id: rowId, timesheetId: id, projectId: row.projectId, activityId: row.activityId,
        monday: row.monday || 0, tuesday: row.tuesday || 0, wednesday: row.wednesday || 0,
        thursday: row.thursday || 0, friday: row.friday || 0, saturday: row.saturday || 0,
        sunday: row.sunday || 0, totalHours: total, comments: row.comments ?? null, createdAt: now,
      });
    }

    await db.update(timesheetsTable).set({ totalHours, updatedAt: now }).where(eq(timesheetsTable.id, id));
    return this.findById(id);
  }

  async update(id: string, rows: any[]) {
    const ts = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!ts[0] || ts[0].status !== "Draft") return null;
    await db.delete(timesheetRowsTable).where(eq(timesheetRowsTable.timesheetId, id));
    const now = new Date();
    let totalHours = 0;
    for (const row of rows) {
      const rowId = generateId();
      const total = calcTotal(row);
      totalHours += total;
      await db.insert(timesheetRowsTable).values({
        id: rowId, timesheetId: id, projectId: row.projectId, activityId: row.activityId,
        monday: row.monday || 0, tuesday: row.tuesday || 0, wednesday: row.wednesday || 0,
        thursday: row.thursday || 0, friday: row.friday || 0, saturday: row.saturday || 0,
        sunday: row.sunday || 0, totalHours: total, comments: row.comments ?? null, createdAt: now,
      });
    }
    await db.update(timesheetsTable).set({ totalHours, updatedAt: now }).where(eq(timesheetsTable.id, id));
    return this.findById(id);
  }

  async submit(id: string) {
    await db.update(timesheetsTable).set({ status: "Submitted", submittedAt: new Date(), updatedAt: new Date() }).where(eq(timesheetsTable.id, id));
    return this.findById(id);
  }

  async approve(id: string, approvedBy: string, comment?: string) {
    await db.update(timesheetsTable).set({ status: "Approved", approvedAt: new Date(), approvedBy, updatedAt: new Date() }).where(eq(timesheetsTable.id, id));
    return this.findById(id);
  }

  async reject(id: string, comment: string) {
    await db.update(timesheetsTable).set({ status: "Rejected", rejectionComment: comment, updatedAt: new Date() }).where(eq(timesheetsTable.id, id));
    return this.findById(id);
  }

  async bulkAction(ids: string[], action: "approve" | "reject", approvedBy: string, comment?: string) {
    let succeeded = 0, failed = 0;
    for (const id of ids) {
      try {
        if (action === "approve") await this.approve(id, approvedBy, comment);
        else await this.reject(id, comment ?? "Rejected");
        succeeded++;
      } catch { failed++; }
    }
    return { processed: ids.length, succeeded, failed };
  }

  async copyFromPreviousWeek(employeeId: string, sourceWeekStartDate: string, targetWeekStartDate: string) {
    const source = await this.findByEmployeeAndWeek(employeeId, sourceWeekStartDate);
    if (!source || !source.rows) throw new Error("Source week not found");
    const existing = await this.findByEmployeeAndWeek(employeeId, targetWeekStartDate);
    if (existing) return existing;
    const rows = source.rows.map((r: any) => ({
      projectId: r.projectId, activityId: r.activityId,
      monday: r.monday, tuesday: r.tuesday, wednesday: r.wednesday,
      thursday: r.thursday, friday: r.friday, saturday: r.saturday, sunday: r.sunday,
      comments: r.comments,
    }));
    return this.create({ employeeId, weekStartDate: targetWeekStartDate }, rows);
  }

  async getStatusBreakdown() {
    const result = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected
      FROM timesheets
    `);
    const r = (result.rows as any[])[0] || {};
    return { draft: Number(r.draft||0), submitted: Number(r.submitted||0), approved: Number(r.approved||0), rejected: Number(r.rejected||0) };
  }

  async getRecentActivity(limit: number) {
    const result = await db.execute(sql`
      SELECT t.id as timesheet_id, t.status, t.week_start_date, t.updated_at as timestamp, e.name as employee_name
      FROM timesheets t
      JOIN employees e ON t.employee_id = e.id
      ORDER BY t.updated_at DESC
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map((r) => ({
      id: r.timesheet_id,
      action: r.status,
      employeeName: r.employee_name,
      weekStartDate: r.week_start_date,
      timestamp: r.timestamp,
      timesheetId: r.timesheet_id,
    }));
  }

  async getComplianceOverview() {
    const result = await db.execute(sql`
      SELECT 
        e.department,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT CASE WHEN t.status IN ('Submitted','Approved') THEN e.id END) as submitted
      FROM employees e
      LEFT JOIN timesheets t ON e.id = t.employee_id AND t.week_start_date >= (CURRENT_DATE - INTERVAL '4 weeks')::text
      WHERE e.status = 'Active'
      GROUP BY e.department
      ORDER BY e.department
    `);
    return (result.rows as any[]).map((r) => ({
      department: r.department,
      totalEmployees: Number(r.total_employees),
      submitted: Number(r.submitted),
      complianceRate: Number(r.total_employees) > 0 ? Math.round((Number(r.submitted) / Number(r.total_employees)) * 100) : 0,
    }));
  }
}
