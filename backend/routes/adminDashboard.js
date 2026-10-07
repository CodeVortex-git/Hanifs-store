const express = require("express");
const { getDashboard } = require("../controllers/adminDashboardController");
const { authenticateAdminSession, requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.get("/dashboard", (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
}, authenticateAdminSession, requireAdmin, getDashboard);

module.exports = router;
