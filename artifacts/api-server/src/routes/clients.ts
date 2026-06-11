import { Router } from "express";
import { clientRepo, auditRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const result = await clientRepo.findAll({ page: Number(req.query.page)||1, pageSize: Number(req.query.pageSize)||20, status: req.query.status as string, search: req.query.search as string });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/clients", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const client = await clientRepo.create(req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Client Created", entityType: "Client", entityId: client.id, newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.status(201).json(client);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/clients/:clientId", requireAuth, async (req, res) => {
  try {
    const client = await clientRepo.findById(req.params.clientId);
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/clients/:clientId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const old = await clientRepo.findById(req.params.clientId);
    const client = await clientRepo.update(req.params.clientId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Client Updated", entityType: "Client", entityId: req.params.clientId, oldValue: JSON.stringify(old), newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(client);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/clients/:clientId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    await clientRepo.delete(req.params.clientId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Client Deleted", entityType: "Client", entityId: req.params.clientId, ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
