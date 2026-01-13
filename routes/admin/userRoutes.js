// routes/admin/userRoutes.js
const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../../middleware/validateRequest");
const userController = require("../../controllers/admin/userController");
const { authenticate } = require("../../middleware/authenticate");
const checkPermission = require("../../middleware/checkPermission");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/admin/users - Get all users (requires manage-users permission)
router.get("/", checkPermission("manage-users"), userController.getUsers);

// GET /api/admin/users/permissions - Get all permissions
router.get("/permissions", userController.getPermissions);

// POST /api/admin/users - Create new user (requires manage-users permission)
router.post("/",
  checkPermission("manage-users"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("role").isIn(["admin", "sub-admin", "manager", "support"]).withMessage("Invalid role"),
    body("permissions").optional().isArray().withMessage("Permissions must be an array")
  ],
  validateRequest,
  userController.addUser
);

// PUT /api/admin/users/:id - Update user (requires manage-users permission)
router.put("/:id",
  checkPermission("manage-users"),
  [
    body("name").optional().trim().notEmpty(),
    body("email").optional().isEmail().normalizeEmail(),
    body("role").optional().isIn(["admin", "sub-admin", "manager", "support"]),
    body("permissions").optional().isArray()
  ],
  validateRequest,
  userController.editUser
);

// PATCH /api/admin/users/:id/toggle-active - Toggle active status (requires manage-users permission)
router.patch("/:id/toggle-active", checkPermission("manage-users"), userController.toggleActive);

// DELETE /api/admin/users/:id - Delete user (requires manage-users permission)
router.delete("/:id", checkPermission("manage-users"), userController.removeUser);

module.exports = router;