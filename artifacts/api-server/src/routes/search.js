const express = require("express");
// const { store } = require("../data/store");
const employeeRepo = require("../repositories/employees");
const clientRepo = require("../repositories/clients");
const projectRepo = require("../repositories/projects");
const timesheetRepo = require("../repositories/timesheets");
const { requireAuth, asyncHandler } = require("../lib/auth");

const router = express.Router();

// function searchTimesheets(q, limit, managerId = null) {
//   const ql = q.toLowerCase();
//   let rows = store.timesheets.filter(
//     (t) => store.employees.find((e) => e.id === t.employeeId)?.name.toLowerCase().includes(ql) || t.weekStartDate.includes(q),
//   );
//   if (managerId) {
//     const teamIds = new Set(store.employees.filter((e) => e.managerId === managerId).map((e) => e.id));
//     rows = rows.filter((t) => teamIds.has(t.employeeId));
//   }
//   rows = [...rows].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, limit);
//   return rows.map((t) => ({
//     id: t.id,
//     employeeId: t.employeeId,
//     weekStartDate: t.weekStartDate,
//     weekEndDate: t.weekEndDate,
//     status: t.status,
//     totalHours: t.totalHours,
//     employeeName: store.employees.find((e) => e.id === t.employeeId)?.name ?? null,
//   }));
// }

router.get(
  "/search",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = req.query.q;
    if (!q?.toString().trim()) {
      return res.json({ employees: [], projects: [], clients: [], timesheets: [] });
    }

    const user = req.session.user;

    if (user.role === "Employee") {
      const employees = await employeeRepo.findAll(1, 5, q, null, null, null, null);
      const self = employees.data.filter((e) => e.id === user.id);
      const myTs = await timesheetRepo.findAll(1, 5, user.id, null, q, null);
      return res.json({ employees: self, projects: [], clients: [], timesheets: myTs.data });
    }

    if (user.role === "Manager") {
      const [emp, proj, client] = await Promise.all([
        employeeRepo.findAll(1, 5, q, null, null, null, user.id),
        projectRepo.findAll(1, 5, "Active", null, q),
        clientRepo.findAll(1, 5, "Active", q),
      ]);
      return res.json({
        employees: emp.data,
        projects: proj.data,
        clients: client.data,
        // timesheets: searchTimesheets(q, 5, user.id),
        timesheets: await timesheetRepo.searchTimesheets(q, 5, user.id),
      });
    }

    const [emp, proj, client] = await Promise.all([
      employeeRepo.findAll(1, 5, q, null, null, null, null),
      projectRepo.findAll(1, 5, null, null, q),
      clientRepo.findAll(1, 5, null, q),
    ]);
    res.json({
      employees: emp.data,
      projects: proj.data,
      clients: client.data,
      // timesheets: searchTimesheets(q, 5),
      timesheets: await timesheetRepo.searchTimesheets(q, 5),
    });
  }),
);

module.exports = router;
