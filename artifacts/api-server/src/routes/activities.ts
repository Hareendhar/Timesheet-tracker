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
    const activityId = req.params.activityId as string;
    const old = await activityRepo.findById(activityId);
    const activity = await activityRepo.update(activityId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Activity Updated", entityType: "Activity", entityId: activityId, oldValue: JSON.stringify(old), newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(activity);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/activities/:activityId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const activityId = req.params.activityId as string;
    const old = await activityRepo.findById(activityId);
    await activityRepo.delete(activityId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Activity Deleted", entityType: "Activity", entityId: activityId, oldValue: JSON.stringify(old), ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
