const express = require("express");
const DiscountController = require("../../controllers/admin/discountController");
const { authenticate } = require("../../middleware/authenticate");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create discount
router.post("/", DiscountController.createDiscount);

// Get all discounts (with optional status filter)
router.get("/", DiscountController.getAllDiscounts);

// Get discount by ID
router.get("/:id", DiscountController.getDiscountById);

// Update discount
router.put("/:id", DiscountController.updateDiscount);

// Toggle discount status
router.patch("/:id/toggle-status", DiscountController.toggleStatus);

// Delete discount
router.delete("/:id", DiscountController.deleteDiscount);

// Validate discount code (for customer use)
router.post("/validate", DiscountController.validateDiscount);

module.exports = router;