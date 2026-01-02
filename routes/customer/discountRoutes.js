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
    const validDiscounts = discounts.filter(d => 
      new Date(d.start_date) <= now && new Date(d.end_date) >= now
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
    const activeDiscounts = allDiscounts.filter(d => 
      new Date(d.start_date) <= now && new Date(d.end_date) >= now
    );

    const eligibleDiscounts = [];

    for (const discount of activeDiscounts) {
      // Skip manual discount types (require coupon code)
      if (discount.type === "Coupon Code" || discount.type === "Flat Price Off") {
        continue;
      }

      // Check if discount applies to teas in cart
      const linkedTeas = discount.linked_teas || [];
      let appliesToCart = true;

      if (linkedTeas.length > 0) {
        // Discount is tea-specific
        const linkedTeaIds = linkedTeas.map(t => t.id);
        appliesToCart = teaIds.some(id => linkedTeaIds.includes(id));
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
          // Check if cart has required quantity
          const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
          if (discount.buy_quantity && totalQuantity >= discount.buy_quantity) {
            // Give discount equal to cheapest item
            const cheapestPrice = Math.min(...cartItems.map(i => i.price));
            calculatedAmount = cheapestPrice * (discount.get_quantity || 1);
            eligible = true;
          }
          break;

        case "Free Product":
          // Apply if minimum cart value is met
          if (discount.min_cart_value && cartValue >= discount.min_cart_value) {
            // For free product, we'll mark it as eligible
            // The actual free product needs to be handled in cart
            calculatedAmount = 0; // We'll handle this differently
            eligible = true;
          }
          break;

        default:
          continue;
      }

      if (eligible && calculatedAmount > 0) {
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

module.exports = router;