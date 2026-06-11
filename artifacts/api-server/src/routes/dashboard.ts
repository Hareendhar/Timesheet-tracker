import { Router } from "express";
import { timesheetRepo, employeeRepo, clientRepo, projectRepo } from "../repositories/index.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    const [breakdown, employeeCounts, clientCount, projectCount] = await Promise.all([
      timesheetRepo.getStatusBreakdown(),
      db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN role = 'Manager' THEN 1 END) as managers,
          COUNT(CASE WHEN role = 'Admin' THEN 1 END) as admins
        FROM employees WHERE status = 'Active'
      `),
      db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE status = 'Active'`),
      db.execute(sql`SELECT COUNT(*) as count FROM projects WHERE status = 'Active'`),
    ]);
    const ec = (employeeCounts.rows as any[])[0] || {};
    const total = Number(ec.total || 0);
    const managers = Number(ec.managers || 0);
    const submitted = breakdown.submitted + breakdown.approved + breakdown.rejected;
    const pending = breakdown.submitted;
    const complianceRate = total > 0 ? Math.round((breakdown.approved / Math.max(submitted, 1)) * 100) : 0;
    res.json({
      totalEmployees: total,
      totalManagers: managers,
      totalProjects: Number((projectCount.rows as any[])[0]?.count || 0),
      totalClients: Number((clientCount.rows as any[])[0]?.count || 0),
      timesheetsSubmitted: submitted,
      timesheetsApproved: breakdown.approved,
      timesheetsRejected: breakdown.rejected,
      pendingApprovals: pending,
      complianceRate,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/timesheet-status-breakdown", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    res.json(await timesheetRepo.getStatusBreakdown());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/recent-activity", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    res.json(await timesheetRepo.getRecentActivity(limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/compliance-overview", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    res.json(await timesheetRepo.getComplianceOverview());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Employee-safe dashboard: only the calling employee's own timesheet data
router.get("/dashboard/my-stats", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const result = await timesheetRepo.findAll({ employeeId: user.id, pageSize: 1000 });
    const ts = result.data as any[];
    const total      = ts.length;
    const drafts     = ts.filter((t) => t.status === "Draft").length;
    const submitted  = ts.filter((t) => t.status === "Submitted").length;
    const approved   = ts.filter((t) => t.status === "Approved").length;
    const rejected   = ts.filter((t) => t.status === "Rejected").length;
    const totalHours = ts.reduce((sum: number, t: any) => sum + (Number(t.totalHours) || 0), 0);
    res.json({ total, drafts, submitted, approved, rejected, totalHours });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
