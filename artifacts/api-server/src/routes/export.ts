import { Router } from "express";
import { employeeRepo, clientRepo, projectRepo, timesheetRepo, auditRepo } from "../repositories/index.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

function toCSV(data: any[], columns: string[]): string {
  const header = columns.join(",");
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col] ?? "";
      const str = String(val).replace(/"/g, '""');
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

router.get("/export/employees", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const result = await employeeRepo.findAll({ pageSize: 10000 });
    const csv = toCSV(result.data, ["employeeId", "name", "email", "department", "designation", "role", "status", "managerName", "createdAt"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=employees.csv");
    res.send(csv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/export/timesheets", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    const result = await timesheetRepo.findAll({ pageSize: 10000, ...(req.query.dateFrom ? {} : {}) });
    const flat = result.data.map((ts: any) => ({
      employeeName: ts.employeeName,
      weekStartDate: ts.weekStartDate,
      weekEndDate: ts.weekEndDate,
      status: ts.status,
      totalHours: ts.totalHours,
      submittedAt: ts.submittedAt ?? "",
      approvedAt: ts.approvedAt ?? "",
      approverName: ts.approverName ?? "",
      rejectionComment: ts.rejectionComment ?? "",
    }));
    const csv = toCSV(flat, ["employeeName", "weekStartDate", "weekEndDate", "status", "totalHours", "submittedAt", "approvedAt", "approverName", "rejectionComment"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=timesheets.csv");
    res.send(csv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/export/audit-logs", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const data = await auditRepo.findAll_export({ dateFrom: req.query.dateFrom as string, dateTo: req.query.dateTo as string });
    const csv = toCSV(data, ["userId", "userName", "role", "action", "entityType", "entityId", "oldValue", "newValue", "ipAddress", "createdAt"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
    res.send(csv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
