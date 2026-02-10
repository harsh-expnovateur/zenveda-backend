// routes/customer/discountRoutes.js

const express = require("express");
const DiscountModel = require("../../models/admin/discountModel");
const router = express.Router();

// Get active discounts (public)
router.get("/active", async (req, res) => {
  try {
    const discounts = await DiscountModel.getAll("active");

    // Filter to only show active discounts within valid date range
    const now = new Date();
    const validDiscounts = discounts.filter(
      (d) => new Date(d.start_date) <= now && new Date(d.end_date) >= now,
    );

    res.json({
      success: true,
      discounts: validDiscounts,
    });
  } catch (error) {
    console.error("Get active discounts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch discounts",
    });
  }
});

// Auto-apply eligible discounts
router.post("/auto-apply", async (req, res) => {
  try {
    const { cartValue, teaIds, cartItems } = req.body;

    if (!cartValue || !Array.isArray(teaIds) || !Array.isArray(cartItems)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    // Get all active discounts
    const allDiscounts = await DiscountModel.getAll("active");
    const now = new Date();

    // Filter valid discounts
    const activeDiscounts = allDiscounts.filter(
      (d) => new Date(d.start_date) <= now && new Date(d.end_date) >= now,
    );

    const eligibleDiscounts = [];

    for (const discount of activeDiscounts) {
      // Skip manual discount types (require coupon code)
      if (
        discount.type === "Coupon Code" ||
        discount.type === "Flat Price Off"
      ) {
        continue;
      }

      // Check if discount applies to teas in cart
      const linkedTeas = discount.linked_teas || [];
      let appliesToCart = true;

      if (linkedTeas.length > 0) {
        // Discount is tea-specific
        const linkedTeaIds = linkedTeas.map((t) => t.id);
        appliesToCart = teaIds.some((id) => linkedTeaIds.includes(id));
      }

      if (!appliesToCart) continue;

      let calculatedAmount = 0;
      let eligible = false;

      // Calculate discount based on type
      switch (discount.type) {
        case "Direct Percentage":
          // Apply automatically without conditions
          calculatedAmount = (cartValue * discount.discount_percentage) / 100;
          eligible = true;
          break;

        case "Cart Value Offer":
          // Apply only if minimum cart value is met
          if (discount.min_cart_value && cartValue >= discount.min_cart_value) {
            calculatedAmount = (cartValue * discount.discount_percentage) / 100;
            eligible = true;
          }
          break;

        case "BOGO / Quantity Offer":
          // 🔥 BOGO is quantity-based, NOT price-based
          eligible = true;

          eligibleDiscounts.push({
            id: discount.id,
            name: discount.name,
            type: "BOGO",
            buy_quantity: discount.buy_quantity,
            get_quantity: discount.get_quantity,
            tea_ids: (discount.linked_teas || []).map((t) => t.id),
            calculatedAmount: 0, // 🔥 ALWAYS ZERO
            description: `Buy ${discount.buy_quantity} Get ${discount.get_quantity} Free`,
          });
          continue;

        case "Free Product":
          // Apply if minimum cart value is met
          if (discount.min_cart_value && cartValue >= discount.min_cart_value) {
            eligibleDiscounts.push({
              id: discount.id,
              name: discount.name,
              type: "Free Product",
              free_product: discount.free_product, // ✅ IMPORTANT
              free_product_quantity: discount.free_product_quantity || 1, // ✅ IMPORTANT
              calculatedAmount: 0,
              description: `Free product on orders above ₹${discount.min_cart_value}`,
            });
          }
          break;

        default:
          continue;
      }

      if (eligible) {
        // Ensure discount doesn't exceed cart value
        calculatedAmount = Math.min(calculatedAmount, cartValue);

        eligibleDiscounts.push({
          id: discount.id,
          name: discount.name,
          type: discount.type,
          calculatedAmount,
          description: getDiscountDescription(discount, calculatedAmount),
        });
      }
    }

    res.json({
      success: true,
      discounts: eligibleDiscounts,
    });
  } catch (error) {
    console.error("Auto-apply discounts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply discounts",
    });
  }
});

// Helper function to generate discount description
function getDiscountDescription(discount, amount) {
  switch (discount.type) {
    case "Direct Percentage":
      return `${discount.discount_percentage}% off applied`;
    case "Cart Value Offer":
      return `${discount.discount_percentage}% off on orders above ₹${discount.min_cart_value}`;
    case "BOGO / Quantity Offer":
      return `Buy ${discount.buy_quantity} Get ${discount.get_quantity} free`;
    case "Free Product":
      return `Free ${discount.free_product} on orders above ₹${discount.min_cart_value}`;
    default:
      return `Save ₹${amount.toFixed(2)}`;
  }
}

// Validate coupon code (CUSTOMER)
router.post("/validate", async (req, res) => {
  try {
    const { code, cartValue, teaIds } = req.body;

    if (!code || !cartValue) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    const result = await DiscountModel.validateForCustomer({
      code,
      cartValue,
      teaIds,
    });

    if (!result.valid) {
      return res.json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      discount: result.discount,
    });
  } catch (err) {
    console.error("Customer coupon validate error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
    });
  }
});


module.exports = router;
