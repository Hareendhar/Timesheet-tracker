import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq, like, and, or, sql, ilike } from "drizzle-orm";
import { generateId } from "../../lib/id.js";
import type { IEmployeeRepository } from "../interfaces.js";

export class PostgresEmployeeRepository implements IEmployeeRepository {
  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    status?: string;
    department?: string;
    managerId?: string;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.search) {
      conditions.push(
        or(
          ilike(employeesTable.name, `%${params.search}%`),
          ilike(employeesTable.email, `%${params.search}%`),
          ilike(employeesTable.employeeId, `%${params.search}%`)
        )
      );
    }
    if (params.role) conditions.push(eq(employeesTable.role, params.role as any));
    if (params.status) conditions.push(eq(employeesTable.status, params.status as any));
    if (params.department) conditions.push(ilike(employeesTable.department, `%${params.department}%`));
    if (params.managerId) conditions.push(eq(employeesTable.managerId, params.managerId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, countResult] = await Promise.all([
      db.select().from(employeesTable).where(where).limit(pageSize).offset(offset).orderBy(employeesTable.name),
      db.select({ count: sql<number>`count(*)` }).from(employeesTable).where(where),
    ]);

    const enriched = await this._enrichWithManagerNames(rows);
    return { data: enriched, total: Number(countResult[0].count), page, pageSize };
  }

  async _enrichWithManagerNames(employees: any[]) {
    const managerIds = [...new Set(employees.map((e) => e.managerId).filter(Boolean))];
    if (managerIds.length === 0) return employees.map((e) => ({ ...e, managerName: null }));
    const managers = await db.select().from(employeesTable).where(
      or(...managerIds.map((id) => eq(employeesTable.id, id!)))
    );
    const managerMap = new Map(managers.map((m) => [m.id, m.name]));
    return employees.map((e) => ({ ...e, managerName: e.managerId ? managerMap.get(e.managerId) ?? null : null }));
  }

  async findById(id: string) {
    const rows = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!rows[0]) return null;
    const [enriched] = await this._enrichWithManagerNames([rows[0]]);
    return enriched;
  }

  async findByEmail(email: string) {
    const rows = await db.select().from(employeesTable).where(eq(employeesTable.email, email));
    return rows[0] ?? null;
  }

  async findByEmployeeId(employeeId: string) {
    const rows = await db.select().from(employeesTable).where(eq(employeesTable.employeeId, employeeId));
    return rows[0] ?? null;
  }

  async create(data: any) {
    const id = generateId();
    const now = new Date();
    const row = { ...data, id, createdAt: now, updatedAt: now };
    await db.insert(employeesTable).values(row);
    return this.findById(id);
  }

  async update(id: string, data: any) {
    await db.update(employeesTable).set({ ...data, updatedAt: new Date() }).where(eq(employeesTable.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await db.update(employeesTable).set({ status: "Inactive", updatedAt: new Date() }).where(eq(employeesTable.id, id));
    return true;
  }

  async bulkCreate(rows: any[]) {
    const success: any[] = [];
    const errors: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.employeeId) throw new Error("Missing Employee ID");
        if (!row.name) throw new Error("Missing Name");
        if (!row.email) throw new Error("Missing Email");
        if (!["Employee", "Manager", "Admin"].includes(row.role)) throw new Error(`Invalid role: ${row.role}`);
        if (!["Active", "Inactive"].includes(row.status)) throw new Error(`Invalid status: ${row.status}`);
        const existing = await this.findByEmployeeId(row.employeeId);
        if (existing) throw new Error(`Duplicate Employee ID: ${row.employeeId}`);
        const existingEmail = await this.findByEmail(row.email);
        if (existingEmail) throw new Error(`Duplicate Email: ${row.email}`);
        if (row.managerId) {
          const manager = await this.findByEmployeeId(row.managerId);
          if (!manager) throw new Error(`Manager not found: ${row.managerId}`);
          row.managerId = manager.id;
        }
        const created = await this.create(row);
        success.push(created);
      } catch (e: any) {
        errors.push({ row: i + 1, field: "unknown", message: e.message });
      }
    }
    return { success, errors };
  }

  async getProfile(id: string) {
    const employee = await this.findById(id);
    if (!employee) return null;
    const { db: _db, ..._ } = { db };
    const allTimesheets = await db.query ? 
      await db.execute(sql`SELECT status FROM timesheets WHERE employee_id = ${id}`) :
      { rows: [] };
    
    // Use raw SQL for metrics
    const metricsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_submitted,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status IN ('Draft', 'Submitted') THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected
      FROM timesheets WHERE employee_id = ${id}
    `);
    const m = (metricsResult.rows as any[])[0] || {};
    const totalSubmitted = Number(m.total_submitted || 0);
    const approved = Number(m.approved || 0);
    const pending = Number(m.pending || 0);
    const rejected = Number(m.rejected || 0);
    const approvalRate = totalSubmitted > 0 ? Math.round((approved / totalSubmitted) * 100) : 0;
    return {
      employee,
      metrics: { totalSubmitted, pending, rejected, approved, approvalRate },
    };
  }

  async getDirectReports(managerId: string) {
    const manager = await this.findById(managerId);
    if (!manager) return null;
    const reports = await db.select().from(employeesTable).where(eq(employeesTable.managerId, managerId));
    const directReports = await Promise.all(
      reports.map(async (emp) => {
        const result = await db.execute(sql`
          SELECT
            COUNT(CASE WHEN status = 'Submitted' OR status = 'Approved' OR status = 'Rejected' THEN 1 END) as submitted,
            COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved,
            COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected
          FROM timesheets WHERE employee_id = ${emp.id}
        `);
        const s = (result.rows as any[])[0] || {};
        return {
          employee: { ...emp, managerName: manager.name },
          submitted: Number(s.submitted || 0),
          approved: Number(s.approved || 0),
          rejected: Number(s.rejected || 0),
        };
      })
    );
    const metricsResult = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as pending_approvals
      FROM timesheets
      WHERE employee_id IN (SELECT id FROM employees WHERE manager_id = ${managerId})
    `);
    const mm = (metricsResult.rows as any[])[0] || {};
    return {
      manager,
      metrics: {
        totalReports: reports.length,
        approved: Number(mm.approved || 0),
        rejected: Number(mm.rejected || 0),
        pendingApprovals: Number(mm.pending_approvals || 0),
      },
      directReports,
    };
  }
}
