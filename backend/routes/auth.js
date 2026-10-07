const express = require("express");
const { currentUser, login, logout, register, updateCurrentUser } = require("../controllers/authController");
const { authenticateSession, protectCsrf, requireAuthentication } = require("../middleware/auth");
const { loginRateLimit, registerRateLimit } = require("../middleware/authRateLimit");

const router = express.Router();

router.post("/register", authenticateSession, protectCsrf, registerRateLimit, register);
router.post("/login", authenticateSession, protectCsrf, loginRateLimit, login);
router.post("/logout", authenticateSession, protectCsrf, logout);
router.get("/me", authenticateSession, requireAuthentication, currentUser);
router.patch("/me", authenticateSession, requireAuthentication, protectCsrf, updateCurrentUser);

module.exports = router;
