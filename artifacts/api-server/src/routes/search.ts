import { Router } from "express";
import { employeeRepo, clientRepo, projectRepo } from "../repositories/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    if (!q.trim()) { res.json({ employees: [], projects: [], clients: [] }); return; }

    const user = (req.session as any).user;
    const role: string = user.role;

    if (role === "Employee") {
      // Employees can only find themselves — no client/project directory access
      const employees = await employeeRepo.findAll({ search: q, pageSize: 5 });
      const self = employees.data.filter((e: any) => e.id === user.id);
      res.json({ employees: self, projects: [], clients: [] });
      return;
    }

    if (role === "Manager") {
      // Managers see their direct reports + active clients/projects
      const [employees, projects, clients] = await Promise.all([
        employeeRepo.findAll({ search: q, pageSize: 5, managerId: user.id }),
        projectRepo.findAll({ search: q, pageSize: 5, status: "Active" }),
        clientRepo.findAll({ search: q, pageSize: 5, status: "Active" }),
      ]);
      res.json({ employees: employees.data, projects: projects.data, clients: clients.data });
      return;
    }

    // Admin — full search
    const [employees, projects, clients] = await Promise.all([
      employeeRepo.findAll({ search: q, pageSize: 5 }),
      projectRepo.findAll({ search: q, pageSize: 5 }),
      clientRepo.findAll({ search: q, pageSize: 5 }),
    ]);
    res.json({ employees: employees.data, projects: projects.data, clients: clients.data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
