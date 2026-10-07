const express = require("express");
const { listOrders, getOrder, updateOrderStatus } = require("../controllers/adminOrdersController");
const { authenticateAdminSession, protectAdminRequest, requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
}, authenticateAdminSession, requireAdmin);

router.get("/", listOrders);
router.get("/:id", getOrder);
router.patch("/:id/status", protectAdminRequest, updateOrderStatus);

module.exports = router;
