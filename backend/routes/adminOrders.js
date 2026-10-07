const express = require("express");
const { listOrders, getOrder, updateOrderStatus } = require("../controllers/adminOrdersController");
const deliveryController = require("../controllers/deliveryController");
const { authenticateAdminSession, protectAdminRequest, requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
}, authenticateAdminSession, requireAdmin);

router.get("/", listOrders);
router.get("/:id", getOrder);
router.patch("/:id/status", protectAdminRequest, updateOrderStatus);
router.get("/:id/delivery", deliveryController.getAdminDelivery);
router.patch("/:id/delivery", protectAdminRequest, deliveryController.updateDelivery);

module.exports = router;
