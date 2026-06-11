import { Router } from "express";
import { auditRepo } from "../repositories/index.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/audit-logs", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const result = await auditRepo.findAll({
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 50,
      userId: req.query.userId as string,
      action: req.query.action as string,
      role: req.query.role as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
