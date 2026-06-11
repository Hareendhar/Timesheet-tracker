import { Router } from "express";
import { timesheetRepo, employeeRepo, clientRepo, projectRepo } from "../repositories/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
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

router.get("/dashboard/timesheet-status-breakdown", requireAuth, async (req, res) => {
  try {
    res.json(await timesheetRepo.getStatusBreakdown());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    res.json(await timesheetRepo.getRecentActivity(limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/compliance-overview", requireAuth, async (req, res) => {
  try {
    res.json(await timesheetRepo.getComplianceOverview());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
