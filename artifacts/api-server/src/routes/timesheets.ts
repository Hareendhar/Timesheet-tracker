import { Router } from "express";
import { timesheetRepo, auditRepo, notificationRepo, employeeRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.post("/timesheets/bulk-action", requireAuth, requireRole("Manager", "Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { timesheetIds, action, comment } = req.body;
    // Managers may only act on timesheets of their direct reports
    if (user.role === "Manager") {
      for (const id of timesheetIds as string[]) {
        const ts = await timesheetRepo.findById(id);
        if (ts) {
          const emp = await employeeRepo.findById(ts.employeeId);
          if (emp?.managerId !== user.id) { res.status(403).json({ error: "Forbidden: one or more timesheets do not belong to your direct reports" }); return; }
        }
      }
    }
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
    const user = (req.session as any).user;
    const { sourceWeekStartDate, targetWeekStartDate } = req.body;
    // Determine target employee and enforce ownership/reporting chain
    let employeeId: string;
    if (user.role === "Employee") {
      employeeId = user.id;
    } else if (user.role === "Manager") {
      const requested = req.body.employeeId || user.id;
      if (requested !== user.id) {
        const emp = await employeeRepo.findById(requested);
        if (!emp || emp.managerId !== user.id) { res.status(403).json({ error: "Forbidden: not a direct report" }); return; }
      }
      employeeId = requested;
    } else {
      employeeId = req.body.employeeId || user.id;
    }
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
    // Employees can only see their own timesheets — always override
    if (user.role === "Employee") params.employeeId = user.id;
    // Managers can only see their direct reports
    if (user.role === "Manager") params.managerId = user.id;
    const result = await timesheetRepo.findAll(params);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { weekStartDate, rows } = req.body;
    // Determine target employee and enforce ownership/reporting chain
    let employeeId: string;
    if (user.role === "Employee") {
      employeeId = user.id;
    } else if (user.role === "Manager") {
      const requested = req.body.employeeId || user.id;
      if (requested !== user.id) {
        const emp = await employeeRepo.findById(requested);
        if (!emp || emp.managerId !== user.id) { res.status(403).json({ error: "Forbidden: not a direct report" }); return; }
      }
      employeeId = requested;
    } else {
      // Admin may target any employee
      employeeId = req.body.employeeId || user.id;
    }
    const existing = await timesheetRepo.findByEmployeeAndWeek(employeeId, weekStartDate);
    if (existing && existing.status !== "Draft") { res.status(400).json({ error: "A non-draft timesheet for this week already exists" }); return; }
    let ts;
    if (existing) ts = await timesheetRepo.update(existing.id, rows);
    else ts = await timesheetRepo.create({ employeeId, weekStartDate }, rows);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Created/Updated", entityType: "Timesheet", entityId: ts?.id ?? "", ipAddress: getClientIp(req) });
    res.status(201).json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/timesheets/:timesheetId", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const timesheetId = req.params.timesheetId as string;
    const ts = await timesheetRepo.findById(timesheetId);
    if (!ts) { res.status(404).json({ error: "Not found" }); return; }
    // Employees can only view their own; Managers can only view direct reports
    if (user.role === "Employee" && ts.employeeId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    if (user.role === "Manager") {
      const emp = await employeeRepo.findById(ts.employeeId);
      if (emp?.managerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/timesheets/:timesheetId", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const timesheetId = req.params.timesheetId as string;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    // Only the owning employee or Admin can edit timesheet rows; Managers approve/reject, not edit
    if (user.role !== "Admin" && existing.employeeId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    const { rows } = req.body;
    const ts = await timesheetRepo.update(timesheetId, rows);
    if (!ts) { res.status(400).json({ error: "Cannot update non-draft timesheet" }); return; }
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Updated", entityType: "Timesheet", entityId: timesheetId, ipAddress: getClientIp(req) });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/:timesheetId/submit", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const timesheetId = req.params.timesheetId as string;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    // Only the owning employee can submit
    if (existing.employeeId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    const ts = await timesheetRepo.submit(timesheetId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Submitted", entityType: "Timesheet", entityId: timesheetId, ipAddress: getClientIp(req) });
    if (user.managerId) {
      await notificationRepo.create({ userId: user.managerId, type: "TIMESHEET_SUBMITTED", title: "Timesheet Awaiting Approval", message: `${user.name} submitted a timesheet for week of ${ts?.weekStartDate}.`, relatedId: timesheetId, isRead: false });
    }
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/:timesheetId/approve", requireAuth, requireRole("Manager", "Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const timesheetId = req.params.timesheetId as string;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    // Managers can only approve timesheets of their direct reports
    if (user.role === "Manager") {
      const emp = await employeeRepo.findById(existing.employeeId);
      if (emp?.managerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    const { comment } = req.body || {};
    const ts = await timesheetRepo.approve(timesheetId, user.id, comment);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Approved", entityType: "Timesheet", entityId: timesheetId, ipAddress: getClientIp(req) });
    if (ts) await notificationRepo.create({ userId: ts.employeeId, type: "TIMESHEET_APPROVED", title: "Timesheet Approved", message: `Your timesheet for week of ${ts.weekStartDate} has been approved.`, relatedId: timesheetId, isRead: false });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/timesheets/:timesheetId/reject", requireAuth, requireRole("Manager", "Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const timesheetId = req.params.timesheetId as string;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    // Managers can only reject timesheets of their direct reports
    if (user.role === "Manager") {
      const emp = await employeeRepo.findById(existing.employeeId);
      if (emp?.managerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    const { comment } = req.body;
    const ts = await timesheetRepo.reject(timesheetId, comment);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Timesheet Rejected", entityType: "Timesheet", entityId: timesheetId, newValue: comment, ipAddress: getClientIp(req) });
    if (ts) await notificationRepo.create({ userId: ts.employeeId, type: "TIMESHEET_REJECTED", title: "Timesheet Rejected", message: `Your timesheet for week of ${ts.weekStartDate} was rejected. Reason: ${comment}`, relatedId: timesheetId, isRead: false });
    res.json(ts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
