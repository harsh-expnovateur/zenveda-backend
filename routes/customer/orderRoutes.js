// routes/customer/orderRoutes.js
const express = require("express");
const { authenticate } = require("../../middleware/authenticate");
const {
  placeOrder,
  getOrders,
  getOrder,
  cancelOrder,
  getShipmentTrackingCustomer,
  getShippingChargeCustomer
} = require("../../controllers/customer/orderController");
const { calculateShippingCharges } = require("../../services/delhivery_services");

const router = express.Router();

// All order routes require authentication
router.use(authenticate);

/* ⭐ SPECIFIC ROUTES MUST BE ABOVE DYNAMIC ROUTES */

// Calculate shipping charges for checkout preview
router.post("/shipping/calculate", async (req, res) => {
  try {
    const { destinationPin, weightGrams } = req.body;

    if (!destinationPin) {
      return res.status(400).json({
        success: false,
        error: "Destination pincode is required",
      });
    }

    const originPin = process.env.ORIGIN_PINCODE || "122004";
    const weight = weightGrams || 500; // Default 500g if not provided

    const shippingCharge = await calculateShippingCharges({
      mode: "E",
      weightGrams: weight,
      originPin,
      destinationPin,
      orderStatus: "Delivered",
      paymentType: "Pre-paid",
    });

    if (shippingCharge.error) {
      return res.json({
        success: false,
        error: shippingCharge.message || "Failed to calculate charges",
        charges: { total_amount: 0 },
      });
    }
    
    return res.json({
      success: true,
      charges: shippingCharge,
    });

  } catch (err) {
    console.error("Shipping calculation error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Failed to calculate shipping charges" 
    });
  }
});

// Get shipping charge for a pincode (alternative method)
router.get("/shipping-charge/:pincode", getShippingChargeCustomer);

// Standard order routes
router.post("/", placeOrder);
router.get("/", getOrders);

// Dynamic routes at the end
router.get("/:orderId", getOrder);
router.post("/:orderId/cancel", cancelOrder);
router.get("/:orderId/tracking", getShipmentTrackingCustomer);

module.exports = router;