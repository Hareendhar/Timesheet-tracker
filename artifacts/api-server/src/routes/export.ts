import { Router } from "express";
import xlsx from "xlsx";
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

function toXLSX(data: any[], columns: string[]): Buffer {
  const rows = data.map((row) => {
    const r: any = {};
    columns.forEach((col) => { r[col] = row[col] ?? ""; });
    return r;
  });
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows, { header: columns });
  xlsx.utils.book_append_sheet(wb, ws, "Data");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function sendExport(res: any, data: any[], columns: string[], filename: string, format: string) {
  if (format === "xlsx") {
    const buf = toXLSX(data, columns);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}.xlsx`);
    res.send(buf);
  } else {
    const csv = toCSV(data, columns);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}.csv`);
    res.send(csv);
  }
}

router.get("/export/employees", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const result = await employeeRepo.findAll({ pageSize: 10000 });
    const cols = ["employeeId", "name", "email", "department", "designation", "role", "status", "managerName", "createdAt"];
    sendExport(res, result.data, cols, "employees", req.query.format as string || "csv");
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/export/timesheets", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const params: any = { pageSize: 10000 };
    if (user.role === "Manager") params.managerId = user.id;
    const result = await timesheetRepo.findAll(params);
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
    const cols = ["employeeName", "weekStartDate", "weekEndDate", "status", "totalHours", "submittedAt", "approvedAt", "approverName", "rejectionComment"];
    sendExport(res, flat, cols, "timesheets", req.query.format as string || "csv");
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/export/clients", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const result = await clientRepo.findAll({ pageSize: 10000 });
    sendExport(res, result.data, ["clientCode", "name", "status", "createdAt"], "clients", req.query.format as string || "csv");
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/export/projects", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const result = await projectRepo.findAll({ pageSize: 10000 });
    sendExport(res, result.data, ["projectCode", "name", "clientName", "status", "createdAt"], "projects", req.query.format as string || "csv");
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/export/audit-logs", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const data = await auditRepo.findAll_export({ dateFrom: req.query.dateFrom as string, dateTo: req.query.dateTo as string });
    const cols = ["userId", "userName", "role", "action", "entityType", "entityId", "oldValue", "newValue", "ipAddress", "createdAt"];
    sendExport(res, data, cols, "audit-logs", req.query.format as string || "csv");
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
