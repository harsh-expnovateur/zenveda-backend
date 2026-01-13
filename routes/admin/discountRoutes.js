const express = require("express");
const DiscountController = require("../../controllers/admin/discountController");
const { authenticate } = require("../../middleware/authenticate");
const checkPermission = require("../../middleware/checkPermission");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create discount
router.post("/", checkPermission("discount"), DiscountController.createDiscount);

// Get all discounts (with optional status filter)
router.get("/", checkPermission("discount"), DiscountController.getAllDiscounts);

// Get discount by ID
router.get("/:id", checkPermission("discount"), DiscountController.getDiscountById);

// Update discount
router.put("/:id", checkPermission("discount"), DiscountController.updateDiscount);

// Toggle discount status
router.patch("/:id/toggle-status", checkPermission("discount"), DiscountController.toggleStatus);

// Delete discount
router.delete("/:id", checkPermission("discount"), DiscountController.deleteDiscount);

// Validate discount code (for customer use)
router.post("/validate", checkPermission("discount"), DiscountController.validateDiscount);

module.exports = router;