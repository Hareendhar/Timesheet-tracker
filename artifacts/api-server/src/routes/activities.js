const express = require("express");
const activityRepo = require("../repositories/activities");
const auditRepo = require("../repositories/audit");
const { requireAuth, requireRole, asyncHandler } = require("../lib/auth");
const { getClientIp } = require("../lib/clientIp");

const router = express.Router();

router.get(
  "/activities",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await activityRepo.findAll());
  }),
);

router.post(
  "/activities",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const activity = await activityRepo.create(req.body ?? {});
    await auditRepo.create({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "Activity Created",
      entityType: "Activity",
      entityId: activity.id,
      newValue: JSON.stringify(req.body),
      ipAddress: getClientIp(req),
    });
    res.status(201).json(activity);
  }),
);

router.patch(
  "/activities/:activityId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { activityId } = req.params;
    const old = await activityRepo.findById(activityId);
    const activity = await activityRepo.update(activityId, req.body ?? {});
    await auditRepo.create({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "Activity Updated",
      entityType: "Activity",
      entityId: activityId,
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(req.body),
      ipAddress: getClientIp(req),
    });
    res.json(activity);
  }),
);

router.delete(
  "/activities/:activityId",
  requireRole("HR"),
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { activityId } = req.params;
    const old = await activityRepo.findById(activityId);
    await activityRepo.delete(activityId);
    await auditRepo.create({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "Activity Deleted",
      entityType: "Activity",
      entityId: activityId,
      oldValue: JSON.stringify(old),
      ipAddress: getClientIp(req),
    });
    res.json({ ok: true });
  }),
);

module.exports = router;
