// routes/admin/orderRoutes.js
const express = require("express");
const { authenticate, requireAdmin } = require("../../middleware/authenticate");
const {
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  createShipment,
  cancelShipment,
  getShipmentTracking,
  generateShipmentLabel,
  getDashboardStats,
  getMonthlySalesData,
} = require("../../controllers/admin/orderController");

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

router.get("/", getAllOrders);
router.put("/:orderId/status", updateOrderStatus);
router.put("/:orderId/payment", updatePaymentStatus);
router.post("/:orderId/shipment", createShipment);
router.post("/:orderId/shipment/cancel", cancelShipment);
router.get("/:orderId/tracking", getShipmentTracking);
router.post("/:orderId/shipment/label", generateShipmentLabel);
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/monthly-sales", getMonthlySalesData);

module.exports = router;