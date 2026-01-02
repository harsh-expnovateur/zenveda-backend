// routes/customer/authRoutes.js
const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../../middleware/validateRequest");
const createRateLimiter = require("../../middleware/rateLimiter");
const {
  register,
  login,
  refresh,
  logout,
  me,
} = require("../../controllers/customer/authController");
const { authenticate } = require("../../middleware/authenticate");

const router = express.Router();

// Rate limiter for auth routes
const authLimiter = createRateLimiter();

// Validation rules
const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("phone")
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Invalid phone number"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("dob").isDate().withMessage("Invalid date of birth"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
];

const loginValidation = [
  body("email")
    .optional({ checkFalsy: true }) // make optional
    .isEmail()
    .withMessage("Invalid email format"),
  body("phone")
    .optional({ checkFalsy: true }) // make optional
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Invalid phone number format"),
  body("password").notEmpty().withMessage("Password is required"),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Either email or phone is required");
    }
    return true;
  }),
];

// Routes
router.post(
  "/register",
  authLimiter,
  registerValidation,
  validateRequest,
  register
);
router.post("/login", authLimiter, loginValidation, validateRequest, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

module.exports = router;
