import { Router } from "express";
import { employeeRepo } from "../repositories/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Public: list all active employees for the login picker
router.get("/auth/users", async (_req, res) => {
  try {
    const result = await employeeRepo.findAll({ status: "Active", pageSize: 500 });
    res.json(
      result.data.map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        name: e.name,
        email: e.email,
        role: e.role,
        department: e.department,
        designation: e.designation,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Public: select a user to log in as (no password — dev/demo mode)
router.post("/auth/select-user", async (req, res) => {
  try {
    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ message: "id required" }); return; }

    const employee = await employeeRepo.findById(id);
    if (!employee || employee.status === "Inactive") {
      res.status(404).json({ message: "Employee not found or inactive" });
      return;
    }

    (req.session as any).user = {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      designation: employee.designation,
      managerId: employee.managerId ?? null,
      avatarUrl: null,
    };

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

// Get current user
router.get("/auth/me", requireAuth, (req, res) => {
  res.json((req.session as any).user);
});

// Logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
