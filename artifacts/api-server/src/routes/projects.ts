import { Router } from "express";
import { projectRepo, auditRepo } from "../repositories/index.js";
import { requireAuth, requireRole, getClientIp } from "../middlewares/auth.js";

const router = Router();

router.get("/projects", requireAuth, async (req, res) => {
  try {
    const result = await projectRepo.findAll({ page: Number(req.query.page)||1, pageSize: Number(req.query.pageSize)||20, status: req.query.status as string, clientId: req.query.clientId as string, search: req.query.search as string });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/projects", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const project = await projectRepo.create(req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Project Created", entityType: "Project", entityId: project?.id ?? "", newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.status(201).json(project);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await projectRepo.findById(projectId);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    res.json(project);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/projects/:projectId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const projectId = req.params.projectId as string;
    const old = await projectRepo.findById(projectId);
    const project = await projectRepo.update(projectId, req.body);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Project Updated", entityType: "Project", entityId: projectId, oldValue: JSON.stringify(old), newValue: JSON.stringify(req.body), ipAddress: getClientIp(req) });
    res.json(project);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/projects/:projectId", requireAuth, requireRole("Admin"), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const projectId = req.params.projectId as string;
    await projectRepo.delete(projectId);
    await auditRepo.create({ userId: user.id, userName: user.name, role: user.role, action: "Project Deleted", entityType: "Project", entityId: projectId, ipAddress: getClientIp(req) });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
