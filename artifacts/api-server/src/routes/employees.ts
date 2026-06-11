import { Router } from "express";
import xlsx from "xlsx";
import { employeeRepo, auditRepo, notificationRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.get("/employees", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    // Employees can only see themselves — not the full directory
    if (user.role === "Employee") {
      const emp = await employeeRepo.findById(user.id);
      res.json({ data: emp ? [emp] : [], total: emp ? 1 : 0, page: 1, pageSize: 20 });
      return;
    }
    // Managers can only list their direct reports (plus themselves)
    const params: any = {
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
      search: req.query.search as string,
      role: req.query.role as string,
      status: req.query.status as string,
      department: req.query.department as string,
      managerId: req.query.managerId as string,
    };
    if (user.role === "Manager") params.managerId = user.id;
    const result = await employeeRepo.findAll(params);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/employees", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const emp = await employeeRepo.create(req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Employee Created", entityType: "Employee", entityId: emp.id, newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.status(201).json(emp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/bulk-upload-template", requireAuth, requireRole("Admin"), (_req, res) => {
  try {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ["employeeId", "name", "email", "department", "designation", "role", "status", "managerId"],
      ["EMP001", "Jane Smith", "jane.smith@versatileit.com", "Engineering", "Senior Developer", "Employee", "Active", ""],
    ]);
    ws["!cols"] = [12, 20, 32, 18, 22, 10, 10, 40].map((w) => ({ wch: w }));
    xlsx.utils.book_append_sheet(wb, ws, "Employees");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=employee-upload-template.xlsx");
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/employees/bulk-upload", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    let rows: any[];
    // Accept either pre-parsed JSON rows or a base64-encoded XLSX file
    if (req.body.xlsxBase64) {
      const buf = Buffer.from(req.body.xlsxBase64 as string, "base64");
      const wb = xlsx.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
    } else {
      rows = req.body.rows;
    }
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "No rows to import" }); return; }
    const result = await employeeRepo.bulkCreate(rows);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Bulk Employee Upload", entityType: "Employee", newValue: JSON.stringify({ total: rows.length, success: result.success.length, errors: result.errors.length }), ipAddress: getClientIp(req) });
    res.json({ totalRows: rows.length, successCount: result.success.length, errorCount: result.errors.length, errors: result.errors });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/:employeeId/profile", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const employeeId = req.params.employeeId as string;
    // Employees may only fetch their own profile
    if (user.role === "Employee" && employeeId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    // Managers may only fetch their own or direct reports' profiles
    if (user.role === "Manager" && employeeId !== user.id) {
      const emp = await employeeRepo.findById(employeeId);
      if (emp?.managerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    const profile = await employeeRepo.getProfile(employeeId);
    if (!profile) { res.status(404).json({ error: "Not found" }); return; }
    res.json(profile);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/:employeeId/direct-reports", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const employeeId = req.params.employeeId as string;
    // Admin can view anyone's direct reports; all other roles may only view their own
    if (user.role !== "Admin" && employeeId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    const result = await employeeRepo.getDirectReports(employeeId);
    if (!result) { res.status(404).json({ error: "Not found" }); return; }
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/:employeeId", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const employeeId = req.params.employeeId as string;
    // Employees may only fetch their own record
    if (user.role === "Employee" && employeeId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    // Managers may only fetch their own or direct reports' records
    if (user.role === "Manager" && employeeId !== user.id) {
      const candidate = await employeeRepo.findById(employeeId);
      if (candidate?.managerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    const emp = await employeeRepo.findById(employeeId);
    if (!emp) { res.status(404).json({ error: "Not found" }); return; }
    res.json(emp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/employees/:employeeId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const employeeId = req.params.employeeId as string;
    const old = await employeeRepo.findById(employeeId);
    const emp = await employeeRepo.update(employeeId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Employee Updated", entityType: "Employee", entityId: employeeId, oldValue: JSON.stringify(old), newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(emp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/employees/:employeeId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const employeeId = req.params.employeeId as string;
    await employeeRepo.delete(employeeId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Employee Deactivated", entityType: "Employee", entityId: employeeId, ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
