// routes/admin/customerRoutes.js
const express = require("express");
const { authenticate} = require("../../middleware/authenticate");
const checkPermission = require("../../middleware/checkPermission");
const {
  getAllCustomers,
  getCustomerStats,
  getMonthlyCustomerData,
  deleteCustomer,
} = require("../../controllers/admin/customerController");

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
// router.use(requireAdmin);

router.get("/", checkPermission("customers"), getAllCustomers);
router.get("/stats", checkPermission("customers"), getCustomerStats);
router.get("/monthly-data", checkPermission("customers"), getMonthlyCustomerData);
router.delete("/:customerId", checkPermission("customers"), deleteCustomer);

module.exports = router;