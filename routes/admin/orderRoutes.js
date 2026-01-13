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
const checkPermission = require("../../middleware/checkPermission");


const router = express.Router();

// All routes require admin authentication
router.use(authenticate);

// Dashboard
router.get(
  "/dashboard/stats",
  checkPermission("dashboard-stats"),
  getDashboardStats
);

router.get(
  "/dashboard/monthly-sales",
  checkPermission("dashboard-stats"),
  getMonthlySalesData
);

// Orders
router.get("/", checkPermission("orders"), getAllOrders);
router.put("/:orderId/status", checkPermission("orders"), updateOrderStatus);
router.put("/:orderId/payment", checkPermission("orders"), updatePaymentStatus);

// Shipments
router.post("/:orderId/shipment", checkPermission("orders"), createShipment);
router.post("/:orderId/shipment/cancel", checkPermission("orders"), cancelShipment);
router.get("/:orderId/tracking", checkPermission("orders"), getShipmentTracking);
router.post("/:orderId/shipment/label", checkPermission("orders"), generateShipmentLabel);


module.exports = router;