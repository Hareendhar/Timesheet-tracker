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
    const clientId = req.params.clientId as string;
    const client = await clientRepo.findById(clientId);
    if (!client) { res.status(404).json({ error: "Not found" }); return; }
    res.json(client);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/clients/:clientId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const clientId = req.params.clientId as string;
    const old = await clientRepo.findById(clientId);
    const client = await clientRepo.update(clientId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Client Updated", entityType: "Client", entityId: clientId, oldValue: JSON.stringify(old), newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(client);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/clients/:clientId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const clientId = req.params.clientId as string;
    await clientRepo.delete(clientId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Client Deleted", entityType: "Client", entityId: clientId, ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
