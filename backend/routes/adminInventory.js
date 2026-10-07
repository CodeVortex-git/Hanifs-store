const express = require("express");
const controller = require("../controllers/adminInventoryController");
const { authenticateAdminSession, protectAdminRequest, requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
}, authenticateAdminSession, requireAdmin);

router.get("/", controller.listInventory);
router.get("/:variantId", controller.getInventoryItem);
router.post("/:variantId/adjust", protectAdminRequest, controller.adjustInventory);

module.exports = router;
