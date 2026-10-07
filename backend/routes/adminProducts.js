const express = require("express");
const controller = require("../controllers/adminProductController");
const { authenticateAdminSession, protectAdminRequest, requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
}, authenticateAdminSession, requireAdmin);

router.get("/", controller.listProducts);
router.get("/:id", controller.getProduct);
router.post("/", protectAdminRequest, controller.createProduct);
router.patch("/:id", protectAdminRequest, controller.updateProduct);
router.post("/:id/variants", protectAdminRequest, controller.createVariant);
router.patch("/:id/variants/:variantId", protectAdminRequest, controller.updateVariant);

module.exports = router;
