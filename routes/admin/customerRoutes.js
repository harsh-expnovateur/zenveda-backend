// routes/admin/customerRoutes.js
const express = require("express");
const { authenticate, requireAdmin } = require("../../middleware/authenticate");
const {
  getAllCustomers,
  getCustomerStats,
  getMonthlyCustomerData,
  deleteCustomer,
} = require("../../controllers/admin/customerController");

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

router.get("/", getAllCustomers);
router.get("/stats", getCustomerStats);
router.get("/monthly-data", getMonthlyCustomerData);
router.delete("/:customerId", deleteCustomer);

module.exports = router;