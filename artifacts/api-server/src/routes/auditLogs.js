const express = require("express");
const auditRepo = require("../repositories/audit");
const { requireRole, asyncHandler } = require("../lib/auth");

const router = express.Router();

router.get(
  "/audit-logs",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 50, userId, action, role, dateFrom, dateTo } = req.query;
    const result = await auditRepo.findAll(Number(page), Number(pageSize), userId, action, role, dateFrom, dateTo);
    res.json(result);
  }),
);

module.exports = router;
