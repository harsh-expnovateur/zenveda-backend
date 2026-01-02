// routes/customer/addressRoutes.js
const express = require("express");
const { authenticate } = require("../../middleware/authenticate");
const {
  getAddresses,
  getDefault,
  createAddress,
  updateAddressById,
  deleteAddressById,
  setDefault,
  validatePincode
} = require("../../controllers/customer/addressController");

const router = express.Router();

// All address routes require authentication
router.use(authenticate);

router.get("/", getAddresses);
router.get("/default", getDefault);
router.get("/validate-pincode/:pincode", validatePincode);
router.post("/", createAddress);
router.put("/:addressId", updateAddressById);
router.delete("/:addressId", deleteAddressById);
router.put("/:addressId/set-default", setDefault);

module.exports = router;