// routes/authRoutes.js
const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../../middleware/validateRequest");
const authController = require("../../controllers/admin/authController");
const rateLimit = require("../../middleware/rateLimiter")();

const router = express.Router();

// POST /api/auth/register
router.post("/register",
  rateLimit,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 chars"),
    body("name").optional().trim().escape()
  ],
  validateRequest,
  authController.register
);

// POST /api/auth/login
router.post("/login",
  rateLimit,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").exists()
  ],
  validateRequest,
  authController.login
);

// POST /api/auth/refresh
router.post("/refresh", rateLimit, authController.refresh);

// POST /api/auth/logout
router.post("/logout", rateLimit, authController.logout);

// GET /api/auth/me
router.get("/me", rateLimit, authController.me);

module.exports = router;
