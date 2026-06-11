import { Router } from "express";
import { employeeRepo, auditRepo, notificationRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.get("/employees", requireAuth, async (req, res) => {
  try {
    const result = await employeeRepo.findAll({
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
      search: req.query.search as string,
      role: req.query.role as string,
      status: req.query.status as string,
      department: req.query.department as string,
      managerId: req.query.managerId as string,
    });
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

router.post("/employees/bulk-upload", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { rows } = req.body;
    const result = await employeeRepo.bulkCreate(rows);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Bulk Employee Upload", entityType: "Employee", newValue: JSON.stringify({ total: rows.length, success: result.success.length, errors: result.errors.length }), ipAddress: getClientIp(req) });
    const totalRows = rows.length;
    res.json({ totalRows, successCount: result.success.length, errorCount: result.errors.length, errors: result.errors });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/:employeeId/profile", requireAuth, async (req, res) => {
  try {
    const profile = await employeeRepo.getProfile(req.params.employeeId);
    if (!profile) return res.status(404).json({ error: "Not found" });
    res.json(profile);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/:employeeId/direct-reports", requireAuth, async (req, res) => {
  try {
    const result = await employeeRepo.getDirectReports(req.params.employeeId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/employees/:employeeId", requireAuth, async (req, res) => {
  try {
    const emp = await employeeRepo.findById(req.params.employeeId);
    if (!emp) return res.status(404).json({ error: "Not found" });
    res.json(emp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/employees/:employeeId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const old = await employeeRepo.findById(req.params.employeeId);
    const emp = await employeeRepo.update(req.params.employeeId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Employee Updated", entityType: "Employee", entityId: req.params.employeeId, oldValue: JSON.stringify(old), newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(emp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/employees/:employeeId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    await employeeRepo.delete(req.params.employeeId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Employee Deactivated", entityType: "Employee", entityId: req.params.employeeId, ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
