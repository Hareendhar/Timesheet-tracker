import { Router } from "express";
import { timesheetRepo, auditRepo, notificationRepo, employeeRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.post("/timesheets/bulk-action", requireAuth, requireRole("Manager", "Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { timesheetIds, action, comment } = req.body;
    const result = await timesheetRepo.bulkAction(timesheetIds, action, user.id, comment);
    for (const id of timesheetIds) {
      const ts = await timesheetRepo.findById(id);
      if (ts) {
        await notificationRepo.create({ userId: ts.employeeId, type: action === "approve" ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED", title: action === "approve" ? "Timesheet Approved" : "Timesheet Rejected", message: action === "approve" ? `Your timesheet for week of ${ts.weekStartDate} has been approved.` : `Your timesheet for week of ${ts.weekStartDate} was rejected. ${comment || ""}`, relatedId: id, isRead: false });
      }
    }
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/copy-previous-week", requireAuth, async (req, res) => {
  try {
    const { sourceWeekStartDate, targetWeekStartDate, employeeId } = req.body;
    const ts = await timesheetRepo.copyFromPreviousWeek(employeeId, sourceWeekStartDate, targetWeekStartDate);
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/timesheets", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const params: any = { page: Number(req.query.page)||1, pageSize: Number(req.query.pageSize)||20 };
    if (req.query.employeeId) params.employeeId = req.query.employeeId;
    if (req.query.status) params.status = req.query.status;
    if (req.query.weekStartDate) params.weekStartDate = req.query.weekStartDate;
    if (req.query.managerId) params.managerId = req.query.managerId;
    // Employees only see their own timesheets
    if (user.role === "Employee") params.employeeId = user.id;
    // Managers see their direct reports
    if (user.role === "Manager" && !params.managerId) params.managerId = user.id;
    const result = await timesheetRepo.findAll(params);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { employeeId, weekStartDate, rows } = req.body;
    const existing = await timesheetRepo.findByEmployeeAndWeek(employeeId, weekStartDate);
    if (existing && existing.status !== "Draft") return res.status(400).json({ error: "A non-draft timesheet for this week already exists" });
    let ts;
    if (existing) ts = await timesheetRepo.update(existing.id, rows);
    else ts = await timesheetRepo.create({ employeeId, weekStartDate }, rows);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Created/Updated", entityType: "Timesheet", entityId: ts.id, ipAddress: getClientIp(req) });
    res.status(201).json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/timesheets/:timesheetId", requireAuth, async (req, res) => {
  try {
    const ts = await timesheetRepo.findById(req.params.timesheetId);
    if (!ts) return res.status(404).json({ error: "Not found" });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/timesheets/:timesheetId", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { rows } = req.body;
    const ts = await timesheetRepo.update(req.params.timesheetId, rows);
    if (!ts) return res.status(400).json({ error: "Cannot update non-draft timesheet" });
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Updated", entityType: "Timesheet", entityId: req.params.timesheetId, ipAddress: getClientIp(req) });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/:timesheetId/submit", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const ts = await timesheetRepo.submit(req.params.timesheetId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Submitted", entityType: "Timesheet", entityId: req.params.timesheetId, ipAddress: getClientIp(req) });
    // Notify manager
    if (user.managerId) {
      await notificationRepo.create({ userId: user.managerId, type: "TIMESHEET_SUBMITTED", title: "Timesheet Awaiting Approval", message: `${user.name} submitted a timesheet for week of ${ts?.weekStartDate}.`, relatedId: req.params.timesheetId, isRead: false });
    }
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/:timesheetId/approve", requireAuth, requireRole("Manager", "Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { comment } = req.body || {};
    const ts = await timesheetRepo.approve(req.params.timesheetId, user.id, comment);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Approved", entityType: "Timesheet", entityId: req.params.timesheetId, ipAddress: getClientIp(req) });
    if (ts) await notificationRepo.create({ userId: ts.employeeId, type: "TIMESHEET_APPROVED", title: "Timesheet Approved", message: `Your timesheet for week of ${ts.weekStartDate} has been approved.`, relatedId: req.params.timesheetId, isRead: false });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/:timesheetId/reject", requireAuth, requireRole("Manager", "Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { comment } = req.body;
    const ts = await timesheetRepo.reject(req.params.timesheetId, comment);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Rejected", entityType: "Timesheet", entityId: req.params.timesheetId, newValue: comment, ipAddress: getClientIp(req) });
    if (ts) await notificationRepo.create({ userId: ts.employeeId, type: "TIMESHEET_REJECTED", title: "Timesheet Rejected", message: `Your timesheet for week of ${ts.weekStartDate} was rejected. Reason: ${comment}`, relatedId: req.params.timesheetId, isRead: false });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
