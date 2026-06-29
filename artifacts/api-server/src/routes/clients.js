const express = require("express");
const clientRepo = require("../repositories/clients");
const auditRepo = require("../repositories/audit");
const { requireAuth, requireRole, asyncHandler } = require("../lib/auth");
const { getClientIp } = require("../lib/clientIp");

const router = express.Router();

async function audit(req, action, entityId, oldVal, newVal) {
  const user = req.session.user;
  await auditRepo.create({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action,
    entityType: "Client",
    entityId,
    oldValue: oldVal != null ? JSON.stringify(oldVal) : null,
    newValue: newVal != null ? JSON.stringify(newVal) : null,
    ipAddress: getClientIp(req),
  });
}

router.get(
  "/clients",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 20, status, search } = req.query;
    res.json(await clientRepo.findAll(Number(page), Number(pageSize), status, search));
  }),
);

router.post(
  "/clients",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if (!body.name?.toString().trim()) return res.status(400).json({ error: "name is required" });
    const client = await clientRepo.create(body);
    await audit(req, "Client Created", client.id, null, body);
    res.status(201).json(client);
  }),
);

router.get(
  "/clients/:clientId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const client = await clientRepo.findById(req.params.clientId);
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  }),
);

router.patch(
  "/clients/:clientId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const old = await clientRepo.findById(clientId);
    const client = await clientRepo.update(clientId, req.body ?? {});
    if (!client) return res.status(404).json({ error: "Not found" });
    await audit(req, "Client Updated", clientId, old, req.body);
    res.json(client);
  }),
);

router.delete(
  "/clients/:clientId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const old = await clientRepo.findById(clientId);
    await clientRepo.delete(clientId);
    await audit(req, "Client Deleted", clientId, old, null);
    res.json({ ok: true });
  }),
);

module.exports = router;
