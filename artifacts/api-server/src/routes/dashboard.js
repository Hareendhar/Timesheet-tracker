const express = require("express");
// const { store } = require("../data/store");
const employeeRepo = require("../repositories/employees");
const clientRepo = require("../repositories/clients");
const projectRepo = require("../repositories/projects");
const timesheetRepo = require("../repositories/timesheets");
const { requireAuth, requireRole, asyncHandler } = require("../lib/auth");

const router = express.Router();

router.get(
  "/stats",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    const breakdown = await timesheetRepo.getStatusBreakdown();

    // const activeEmployees = store.employees.filter((e) => e.status === "Active");
    // const total = activeEmployees.length;
    // const managers = activeEmployees.filter((e) => e.role === "Manager").length;
    // const clientCount = store.clients.filter((c) => c.status === "Active").length;
    // const projectCount = store.projects.filter((p) => p.status === "Active").length;
    const employees = await employeeRepo.findAll(
      1,
      10000,
      "",
      "",
      "Active",
      "",
      ""
    );

    const clients = await clientRepo.findAll(
      1,
      10000,
      "",
      "Active"
    );

    const projects = await projectRepo.findAll(
      1,
      10000,
      "",
      "Active",
      ""
    );

    const activeEmployees = employees.data;

    const total = activeEmployees.length;
    const managers = activeEmployees.filter((e) => e.role === "Manager").length;
    const clientCount = clients.data.length;
    const projectCount = projects.data.length;
    const submitted = breakdown.submitted + breakdown.approved + breakdown.rejected;
    const pending = breakdown.submitted;
    const complianceRate = total > 0 ? Math.round((breakdown.approved / Math.max(submitted, 1)) * 100) : 0;

    res.json({
      totalEmployees: total,
      totalManagers: managers,
      totalProjects: projectCount,
      totalClients: clientCount,
      timesheetsSubmitted: submitted,
      timesheetsApproved: breakdown.approved,
      timesheetsRejected: breakdown.rejected,
      pendingApprovals: pending,
      complianceRate,
    });
  }),
);

router.get(
  "/timesheet-status-breakdown",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    res.json(await timesheetRepo.getStatusBreakdown());
  }),
);

router.get(
  "/recent-activity",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 10);
    res.json(await timesheetRepo.getRecentActivity(limit));
  }),
);

router.get(
  "/compliance-overview",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    res.json(await timesheetRepo.getComplianceOverview());
  }),
);

router.get(
  "/my-stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const result = await timesheetRepo.findAll(1, 1000, user.id, null, null, null);
    const ts = result.data;

    const total = ts.length;
    const drafts = ts.filter((t) => t.status === "Draft").length;
    const submitted = ts.filter((t) => t.status === "Submitted").length;
    const approved = ts.filter((t) => t.status === "Approved").length;
    const rejected = ts.filter((t) => t.status === "Rejected").length;
    const totalHours = ts.reduce((sum, t) => sum + Number(t.totalHours), 0);

    res.json({ total, drafts, submitted, approved, rejected, totalHours });
  }),
);

module.exports = router;
