const express = require("express");
const timesheetRepo = require("../repositories/timesheets");
const employeeRepo = require("../repositories/employees");
const notificationRepo = require("../repositories/notifications");
const auditRepo = require("../repositories/audit");
const { requireAuth, requireRole, asyncHandler } = require("../lib/auth");
const { getClientIp } = require("../lib/clientIp");
const { InvalidTransitionException } = require("../lib/exceptions");

const router = express.Router();

function handleTransitionError(err, res) {
  if (err instanceof InvalidTransitionException) return res.status(409).json({ error: err.message });
  throw err;
}

router.post(
  "/timesheets/bulk-action",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { timesheetIds = [], action, comment } = req.body ?? {};
    if (action === "reject" && !comment?.toString().trim())
      return res.status(400).json({ error: "Rejection comment is required" });

    for (const id of timesheetIds) {
      const ts = await timesheetRepo.findById(id);
      if (!ts) return res.status(404).json({ error: `Timesheet ${id} not found` });
      if (ts.status !== "Submitted")
        return res.status(400).json({ error: `Timesheet ${id} is in '${ts.status}' status and cannot be ${action}d` });
      if (user.role === "Manager") {
        const emp = await employeeRepo.findById(ts.employeeId);
        if (!emp || emp.managerId !== user.id)
          return res.status(403).json({ error: "Forbidden: one or more timesheets do not belong to your direct reports" });
      }
    }

    const result = await timesheetRepo.bulkAction(timesheetIds, action, user.id, comment);

    for (const id of timesheetIds) {
      const ts = await timesheetRepo.findById(id);
      if (ts) {
        await notificationRepo.create({
          userId: ts.employeeId,
          type: action === "approve" ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
          title: action === "approve" ? "Timesheet Approved" : "Timesheet Rejected",
          message:
            action === "approve"
              ? `Your timesheet for week of ${ts.weekStartDate} has been approved.`
              : `Your timesheet for week of ${ts.weekStartDate} was rejected. ${comment ?? ""}`,
          relatedId: id,
          isRead: false,
        });
      }
    }

    res.json(result);
  }),
);

router.post(
  "/timesheets/copy-previous-week",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { sourceWeekStartDate, targetWeekStartDate, employeeId: bodyEmployeeId } = req.body ?? {};

    let employeeId;
    if (user.role === "Employee") {
      employeeId = user.id;
    } else if (user.role === "Manager") {
      const requested = bodyEmployeeId ?? user.id;
      if (requested !== user.id) {
        const emp = await employeeRepo.findById(requested);
        if (!emp || emp.managerId !== user.id) return res.status(403).json({ error: "Forbidden: not a direct report" });
      }
      employeeId = requested;
    } else {
      employeeId = bodyEmployeeId ?? user.id;
    }

    const ts = await timesheetRepo.copyFromPreviousWeek(employeeId, sourceWeekStartDate, targetWeekStartDate);
    res.json(ts);
  }),
);

router.get(
  "/timesheets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    let { page = 1, pageSize = 20, employeeId, status, weekStartDate, managerId } = req.query;
    if (user.role === "Employee") {
      employeeId = user.id;
    } else if (user.role === "Manager") {
      // A manager looking at their own timesheets (e.g. "My Timesheets") needs no
      // team-wide scoping — only force managerId when no specific employee was
      // requested (e.g. "Approvals"), or when asking about someone else (still
      // restricted to their own direct reports).
      if (employeeId !== user.id) managerId = user.id;
    }

    const result = await timesheetRepo.findAll(Number(page), Number(pageSize), employeeId, status, weekStartDate, managerId);
    res.json(result);
  }),
);

router.post(
  "/timesheets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { weekStartDate, rows = [], employeeId: bodyEmployeeId } = req.body ?? {};

    let employeeId;
    if (user.role === "Employee") {
      employeeId = user.id;
    } else if (user.role === "Manager") {
      const requested = bodyEmployeeId ?? user.id;
      if (requested !== user.id) {
        const emp = await employeeRepo.findById(requested);
        if (!emp || emp.managerId !== user.id) return res.status(403).json({ error: "Forbidden: not a direct report" });
      }
      employeeId = requested;
    } else {
      employeeId = bodyEmployeeId ?? user.id;
    }

    const existing = await timesheetRepo.findByEmployeeAndWeek(employeeId, weekStartDate);
    if (existing && existing.status !== "Draft")
      return res.status(400).json({ error: "A non-draft timesheet for this week already exists" });

    const ts = existing
      ? await timesheetRepo.update(existing.id, rows)
      : await timesheetRepo.create(employeeId, weekStartDate, rows);

    await auditRepo.create({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "Timesheet Created/Updated",
      entityType: "Timesheet",
      entityId: ts.id,
      ipAddress: getClientIp(req),
    });

    res.status(201).json(ts);
  }),
);

router.get(
  "/timesheets/:timesheetId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const ts = await timesheetRepo.findById(req.params.timesheetId);
    if (!ts) return res.status(404).json({ error: "Not found" });
    if (user.role === "Employee" && ts.employeeId !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (user.role === "Manager" && ts.employeeId !== user.id) {
      const emp = await employeeRepo.findById(ts.employeeId);
      if (!emp || emp.managerId !== user.id) return res.status(403).json({ error: "Forbidden" });
    }
    res.json(ts);
  }),
);

router.patch(
  "/timesheets/:timesheetId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { timesheetId } = req.params;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (user.role !== "HR" && existing.employeeId !== user.id) return res.status(403).json({ error: "Forbidden" });

    const ts = await timesheetRepo.update(timesheetId, req.body?.rows ?? []);
    if (!ts) return res.status(400).json({ error: "Cannot update non-draft timesheet" });

    await auditRepo.create({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "Timesheet Updated",
      entityType: "Timesheet",
      entityId: timesheetId,
      ipAddress: getClientIp(req),
    });
    res.json(ts);
  }),
);

router.post(
  "/timesheets/:timesheetId/submit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { timesheetId } = req.params;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.employeeId !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (existing.status !== "Draft" && existing.status !== "Rejected")
      return res.status(400).json({ error: `Cannot submit a timesheet in '${existing.status}' status` });

    try {
      const ts = await timesheetRepo.submit(timesheetId);
      await auditRepo.create({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: "Timesheet Submitted",
        entityType: "Timesheet",
        entityId: timesheetId,
        ipAddress: getClientIp(req),
      });

      if (user.managerId) {
        await notificationRepo.create({
          userId: user.managerId,
          type: "TIMESHEET_SUBMITTED",
          title: "Timesheet Awaiting Approval",
          message: `${user.name} submitted a timesheet for week of ${ts.weekStartDate}.`,
          relatedId: timesheetId,
          isRead: false,
        });
      }
      res.json(ts);
    } catch (err) {
      handleTransitionError(err, res);
    }
  }),
);

router.post(
  "/timesheets/:timesheetId/approve",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { timesheetId } = req.params;
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (user.role === "Manager") {
      const emp = await employeeRepo.findById(existing.employeeId);
      if (!emp || emp.managerId !== user.id) return res.status(403).json({ error: "Forbidden" });
    }
    if (existing.status !== "Submitted")
      return res.status(400).json({ error: `Cannot approve a timesheet in '${existing.status}' status` });

    try {
      const ts = await timesheetRepo.approve(timesheetId, user.id);
      await auditRepo.create({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: "Timesheet Approved",
        entityType: "Timesheet",
        entityId: timesheetId,
        ipAddress: getClientIp(req),
      });

      await notificationRepo.create({
        userId: existing.employeeId,
        type: "TIMESHEET_APPROVED",
        title: "Timesheet Approved",
        message: `Your timesheet for week of ${existing.weekStartDate} has been approved.`,
        relatedId: timesheetId,
        isRead: false,
      });
      res.json(ts);
    } catch (err) {
      handleTransitionError(err, res);
    }
  }),
);

router.post(
  "/timesheets/:timesheetId/reject",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { timesheetId } = req.params;
    const { comment } = req.body ?? {};
    const existing = await timesheetRepo.findById(timesheetId);
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (user.role === "Manager") {
      const emp = await employeeRepo.findById(existing.employeeId);
      if (!emp || emp.managerId !== user.id) return res.status(403).json({ error: "Forbidden" });
    }
    if (existing.status !== "Submitted")
      return res.status(400).json({ error: `Cannot reject a timesheet in '${existing.status}' status` });
    if (!comment?.toString().trim()) return res.status(400).json({ error: "Rejection comment is required" });

    try {
      const ts = await timesheetRepo.reject(timesheetId, comment);
      await auditRepo.create({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: "Timesheet Rejected",
        entityType: "Timesheet",
        entityId: timesheetId,
        newValue: comment,
        ipAddress: getClientIp(req),
      });

      await notificationRepo.create({
        userId: existing.employeeId,
        type: "TIMESHEET_REJECTED",
        title: "Timesheet Rejected",
        message: `Your timesheet for week of ${existing.weekStartDate} was rejected. Reason: ${comment}`,
        relatedId: timesheetId,
        isRead: false,
      });

      res.json(ts);
    } catch (err) {
      handleTransitionError(err, res);
    }
  }),
);

module.exports = router;
