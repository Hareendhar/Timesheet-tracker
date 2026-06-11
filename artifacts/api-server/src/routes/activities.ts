import { Router } from "express";
import { activityRepo, auditRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.get("/activities", requireAuth, async (req, res) => {
  try {
    res.json(await activityRepo.findAll());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/activities", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const activity = await activityRepo.create(req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Activity Created", entityType: "Activity", entityId: activity.id, newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.status(201).json(activity);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/activities/:activityId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const activity = await activityRepo.update(req.params.activityId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Activity Updated", entityType: "Activity", entityId: req.params.activityId, newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(activity);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/activities/:activityId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    await activityRepo.delete(req.params.activityId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Activity Deleted", entityType: "Activity", entityId: req.params.activityId, ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
