const express = require("express");
const { currentAdmin, login, logout } = require("../controllers/adminAuthController");
const { authenticateAdminSession, protectAdminRequest, requireAdmin } = require("../middleware/adminAuth");
const { adminLoginRateLimit } = require("../middleware/adminRateLimit");

const router = express.Router();
router.post("/login", authenticateAdminSession, protectAdminRequest, adminLoginRateLimit, login);
router.post("/logout", authenticateAdminSession, requireAdmin, protectAdminRequest, logout);
router.get("/me", authenticateAdminSession, requireAdmin, currentAdmin);

module.exports = router;
