const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const employeeRepo = require("../repositories/employees");
const auditRepo = require("../repositories/audit");
const { requireAuth, requireRole, asyncHandler } = require("../lib/auth");
const { getClientIp } = require("../lib/clientIp");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function audit(req, action, entityType, entityId, oldVal, newVal) {
  const user = req.session.user;
  await auditRepo.create({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action,
    entityType,
    entityId,
    oldValue: oldVal != null ? JSON.stringify(oldVal) : null,
    newValue: newVal != null ? JSON.stringify(newVal) : null,
    ipAddress: getClientIp(req),
  });
}

router.get(
  "/employees",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 20, search, role, status, department } = req.query;
    const result = await employeeRepo.findAll(Number(page), Number(pageSize), search, role, status, department, null);
    res.json(result);
  }),
);

router.post(
  "/employees",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if (!body.name?.toString().trim()) return res.status(400).json({ error: "name is required" });
    if (!body.email?.toString().trim()) return res.status(400).json({ error: "email is required" });
    if (!body.department?.toString().trim()) return res.status(400).json({ error: "department is required" });
    if (!body.designation?.toString().trim()) return res.status(400).json({ error: "designation is required" });

    const employee = await employeeRepo.create(body);
    await audit(req, "Employee Created", "Employee", employee.id, null, body);
    res.status(201).json(employee);
  }),
);

router.get(
  "/employees/bulk-upload-template",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Employees");
    const headers = ["employeeId", "name", "email", "department", "designation", "role", "status", "managerId"];
    ws.addRow(headers);
    ws.addRow(["EMP001", "John Doe", "john.doe@example.com", "Engineering", "Software Engineer", "Employee", "Active", ""]);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="employee-template.xlsx"');
    res.send(Buffer.from(buffer));
  }),
);

router.post(
  "/employees/bulk-upload",
  requireRole("HR"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file || req.file.size === 0) return res.status(400).json({ error: "No file uploaded" });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];

    const headers = [];
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() ?? "";
    });

    const rows = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const rowValues = ws.getRow(r);
      const row = {};
      let hasValue = false;
      headers.forEach((header, i) => {
        const val = rowValues.getCell(i + 1).value;
        const str = val == null ? null : val.toString().trim() || null;
        row[header] = str;
        if (str != null) hasValue = true;
      });
      if (hasValue) rows.push(row);
    }

    if (rows.length === 0) return res.status(400).json({ error: "No data rows found in file" });

    const { success, errors } = await employeeRepo.bulkCreate(rows);
    await audit(req, "Employee Bulk Upload", "Employee", null, null, {
      totalRows: rows.length,
      successCount: success.length,
      errorCount: errors.length,
    });

    res.json({ message: `${success.length} employees created successfully`, created: success, errors });
  }),
);

router.get(
  "/employees/:employeeId/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { employeeId } = req.params;

    if (user.role === "Employee" && user.id !== employeeId) return res.status(403).json({ error: "Forbidden" });
    if (user.role === "Manager") {
      const emp = await employeeRepo.findById(employeeId);
      if (!emp) return res.status(404).json({ error: "Not found" });
      if (emp.managerId !== user.id && employeeId !== user.id) return res.status(403).json({ error: "Forbidden" });
    }

    const profile = await employeeRepo.getProfile(employeeId);
    if (!profile) return res.status(404).json({ error: "Not found" });
    res.json(profile);
  }),
);

router.get(
  "/employees/:employeeId/direct-reports",
  requireRole("Manager", "HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { employeeId } = req.params;
    if (user.role === "Manager" && user.id !== employeeId)
      return res.status(403).json({ error: "Forbidden: you can only view your own direct reports" });

    const result = await employeeRepo.getDirectReports(employeeId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  }),
);

router.get(
  "/employees/:employeeId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const employee = await employeeRepo.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ error: "Not found" });
    res.json(employee);
  }),
);

router.patch(
  "/employees/:employeeId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const old = await employeeRepo.findById(employeeId);
    if (!old) return res.status(404).json({ error: "Not found" });
    const employee = await employeeRepo.update(employeeId, req.body ?? {});
    await audit(req, "Employee Updated", "Employee", employeeId, old, req.body);
    res.json(employee);
  }),
);

router.delete(
  "/employees/:employeeId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const old = await employeeRepo.findById(employeeId);
    if (!old) return res.status(404).json({ error: "Not found" });
    await employeeRepo.delete(employeeId);
    await audit(req, "Employee Deleted", "Employee", employeeId, old, null);
    res.json({ ok: true });
  }),
);

module.exports = router;
