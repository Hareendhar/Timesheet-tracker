const express = require("express");
const ExcelJS = require("exceljs");
const employeeRepo = require("../repositories/employees");
const clientRepo = require("../repositories/clients");
const projectRepo = require("../repositories/projects");
const timesheetRepo = require("../repositories/timesheets");
const auditRepo = require("../repositories/audit");
const { requireRole, asyncHandler } = require("../lib/auth");

const router = express.Router();

function toCsv(data, columns) {
  const lines = [columns.join(",")];
  for (const item of data) {
    const vals = columns.map((col) => {
      let val = item[col] != null ? item[col].toString() : "";
      val = val.replace(/"/g, '""');
      if (val.includes(",") || val.includes('"') || val.includes("\n")) val = `"${val}"`;
      return val;
    });
    lines.push(vals.join(","));
  }
  return lines.join("\n") + "\n";
}

async function sendExport(res, data, columns, filename, format) {
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data");
    ws.addRow(columns);
    for (const item of data) ws.addRow(columns.map((c) => (item[c] != null ? item[c].toString() : "")));
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    res.send(Buffer.from(buffer));
  } else {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(toCsv(data, columns));
  }
}

router.get(
  "/employees",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const format = req.query.format ?? "csv";
    const result = await employeeRepo.findAll(1, 10000, null, null, null, null, null);
    const cols = ["employeeId", "name", "email", "department", "designation", "role", "status", "managerName", "createdAt"];
    await sendExport(res, result.data, cols, "employees", format);
  }),
);

router.get(
  "/timesheets",
  requireRole("HR", "Manager"),
  asyncHandler(async (req, res) => {
    const format = req.query.format ?? "csv";
    const user = req.session.user;
    const managerId = user.role === "Manager" ? user.id : null;
    const result = await timesheetRepo.findAll(1, 10000, null, null, null, managerId);
    const flat = result.data.map((ts) => ({
      employeeName: ts.employeeName ?? "",
      weekStartDate: ts.weekStartDate ?? "",
      weekEndDate: ts.weekEndDate ?? "",
      status: ts.status ?? "",
      totalHours: ts.totalHours,
      submittedAt: ts.submittedAt ?? "",
      approvedAt: ts.approvedAt ?? "",
      approverName: ts.approverName ?? "",
      rejectionComment: ts.rejectionComment ?? "",
    }));
    const cols = ["employeeName", "weekStartDate", "weekEndDate", "status", "totalHours", "submittedAt", "approvedAt", "approverName", "rejectionComment"];
    await sendExport(res, flat, cols, "timesheets", format);
  }),
);

router.get(
  "/clients",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const format = req.query.format ?? "csv";
    const result = await clientRepo.findAll(1, 10000, null, null);
    const cols = ["clientCode", "name", "status", "createdAt"];
    await sendExport(res, result.data, cols, "clients", format);
  }),
);

router.get(
  "/projects",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const format = req.query.format ?? "csv";
    const result = await projectRepo.findAll(1, 10000, null, null, null);
    const cols = ["projectCode", "name", "clientName", "status", "createdAt"];
    await sendExport(res, result.data, cols, "projects", format);
  }),
);

router.get(
  "/audit-logs",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { format = "csv", dateFrom, dateTo } = req.query;
    const data = await auditRepo.findAllExport(dateFrom, dateTo);
    const cols = ["userName", "role", "action", "entityType", "entityId", "ipAddress", "createdAt"];
    await sendExport(res, data, cols, "audit-logs", format);
  }),
);


router.get(
  "/monthly-timesheets",
  requireRole("HR"),
  asyncHandler(async (req, res) => {

    const {
      year,
      month,
      projectId,
    } = req.query;

    const data = await timesheetRepo.findApprovedByMonth(
      projectId,
      Number(year),
      Number(month)
    );

    res.json(data);

  })
);

module.exports = router;
