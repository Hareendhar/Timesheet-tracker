import { Router } from "express";
import { employeeRepo, clientRepo, projectRepo } from "../repositories/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    if (!q.trim()) return res.json({ employees: [], projects: [], clients: [] });
    const [employees, projects, clients] = await Promise.all([
      employeeRepo.findAll({ search: q, pageSize: 5 }),
      projectRepo.findAll({ search: q, pageSize: 5 }),
      clientRepo.findAll({ search: q, pageSize: 5 }),
    ]);
    res.json({ employees: employees.data, projects: projects.data, clients: clients.data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
