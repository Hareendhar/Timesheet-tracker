const express = require("express");
const projectRepo = require("../repositories/projects");
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
    entityType: "Project",
    entityId,
    oldValue: oldVal != null ? JSON.stringify(oldVal) : null,
    newValue: newVal != null ? JSON.stringify(newVal) : null,
    ipAddress: getClientIp(req),
  });
}

router.get(
  "/projects",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 20, status, clientId, search } = req.query;
    res.json(await projectRepo.findAll(Number(page), Number(pageSize), status, clientId, search));
  }),
);

router.post(
  "/projects",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if (!body.name?.toString().trim()) return res.status(400).json({ error: "name is required" });
    if (!body.projectCode?.toString().trim()) return res.status(400).json({ error: "projectCode is required" });
    if (!body.clientId?.toString().trim()) return res.status(400).json({ error: "clientId is required" });

    const project = await projectRepo.create(body);
    await audit(req, "Project Created", project.id, null, body);
    res.status(201).json(project);
  }),
);

router.get(
  "/projects/:projectId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await projectRepo.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Not found" });
    res.json(project);
  }),
);

router.patch(
  "/projects/:projectId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const old = await projectRepo.findById(projectId);
    const project = await projectRepo.update(projectId, req.body ?? {});
    if (!project) return res.status(404).json({ error: "Not found" });
    await audit(req, "Project Updated", projectId, old, req.body);
    res.json(project);
  }),
);

router.delete(
  "/projects/:projectId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const old = await projectRepo.findById(projectId);
    await projectRepo.delete(projectId);
    await audit(req, "Project Deleted", projectId, old, null);
    res.json({ ok: true });
  }),
);

module.exports = router;
