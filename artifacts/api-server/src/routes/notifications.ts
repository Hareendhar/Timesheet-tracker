import { Router } from "express";
import { notificationRepo } from "../repositories/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const result = await notificationRepo.findAll({
      userId: user.id,
      unreadOnly: req.query.unreadOnly === "true",
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/notifications/:notificationId/read", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    await notificationRepo.markRead(req.params.notificationId as string, user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    await notificationRepo.markAllRead(user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
