const express = require("express");
const notificationRepo = require("../repositories/notifications");
const { requireAuth, asyncHandler } = require("../lib/auth");

const router = express.Router();

router.get(
  "/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;
    const { unreadOnly = false, page = 1, pageSize = 20 } = req.query;
    const result = await notificationRepo.findAll(user.id, unreadOnly === "true" || unreadOnly === true, Number(page), Number(pageSize));
    res.json(result);
  }),
);

router.patch(
  "/notifications/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await notificationRepo.markAllRead(req.session.user.id);
    res.json({ ok: true });
  }),
);

router.patch(
  "/notifications/:notificationId/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    await notificationRepo.markRead(req.params.notificationId, req.session.user.id);
    res.json({ ok: true });
  }),
);

module.exports = router;
