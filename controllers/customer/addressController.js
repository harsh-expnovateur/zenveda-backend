// controllers/customer/addressController.js
const {
  getCustomerAddresses,
  getDefaultAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../../models/customer/addressModel");
const checkPincodeServiceability =
  require("../../services/delhivery_services").checkPincodeServiceability;

const logger = require("../../config/logger");

/**
 * Get all addresses
 */
const getAddresses = async (req, res) => {
  try {
    const customerId = req.user.id;
    const addresses = await getCustomerAddresses(customerId);

    res.json({
      success: true,
      addresses,
    });
  } catch (err) {
    logger.error("Get addresses error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch addresses",
    });
  }
};

/**
 * Get default address
 */
const getDefault = async (req, res) => {
  try {
    const customerId = req.user.id;
    const address = await getDefaultAddress(customerId);

    res.json({
      success: true,
      address,
    });
  } catch (err) {
    logger.error("Get default address error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch default address",
    });
  }
};

/**
 * Validate pincode serviceability
 */
const validatePincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        error: "Pincode is required",
      });
    }

    const pincodeRes = await checkPincodeServiceability(pincode);

    // Check if delivery is available
    if (
      pincodeRes.delivery_codes &&
      pincodeRes.delivery_codes.length > 0 &&
      pincodeRes.delivery_codes[0].postal_code
    ) {
      const postalData = pincodeRes.delivery_codes[0].postal_code;

      return res.json({
        success: true,
        available: true,
        message: "We are available to deliver in your area",
        data: {
          city: postalData.city || "",
          state: postalData.state_code || "",
          pincode: postalData.pin || pincode,
        },
      });
    } else {
      return res.json({
        success: true,
        available: false,
        message: "We are currently not available in your area. Try another address.",
        data: null,
      });
    }
  } catch (err) {
    logger.error("Validate pincode error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      available: false,
      error: "Failed to validate pincode",
    });
  }
};

/**
 * Add new address
 */
const createAddress = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      name,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      isDefault,
    } = req.body;

    if (!name || !phoneNumber || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        error: "All required fields must be provided",
      });
    }

    // Pincode validation - check if delivery is available
    const pincodeRes = await checkPincodeServiceability(pincode);
    
    if (
      !pincodeRes.delivery_codes ||
      pincodeRes.delivery_codes.length === 0 ||
      !pincodeRes.delivery_codes[0].postal_code
    ) {
      return res.status(400).json({
        success: false,
        error: "We are currently not available in your area. Try another address.",
      });
    }

    logger.info("Pincode serviceability verified", { 
      pincode, 
      city: pincodeRes.delivery_codes[0].postal_code.city 
    });

    const addressId = await addAddress({
      customerId,
      name,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      isDefault: isDefault || false,
    });

    logger.info("Address added", { customerId, addressId });

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addressId,
    });
  } catch (err) {
    logger.error("Add address error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to add address",
    });
  }
};

/**
 * Update address
 */
const updateAddressById = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { addressId } = req.params;
    const {
      name,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      isDefault,
    } = req.body;

    // If pincode is being updated, validate it
    if (pincode) {
      const pincodeRes = await checkPincodeServiceability(pincode);
      
      if (
        !pincodeRes.delivery_codes ||
        pincodeRes.delivery_codes.length === 0 ||
        !pincodeRes.delivery_codes[0].postal_code
      ) {
        return res.status(400).json({
          success: false,
          error: "We are currently not available in your area. Try another address.",
        });
      }
    }

    await updateAddress({
      addressId: parseInt(addressId),
      customerId,
      name,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      isDefault,
    });

    res.json({
      success: true,
      message: "Address updated successfully",
    });
  } catch (err) {
    logger.error("Update address error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to update address",
    });
  }
};

/**
 * Delete address
 */
const deleteAddressById = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { addressId } = req.params;

    await deleteAddress(parseInt(addressId), customerId);

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (err) {
    logger.error("Delete address error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to delete address",
    });
  }
};

/**
 * Set default address
 */
const setDefault = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { addressId } = req.params;

    await setDefaultAddress(parseInt(addressId), customerId);

    res.json({
      success: true,
      message: "Default address updated",
    });
  } catch (err) {
    logger.error("Set default address error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to set default address",
    });
  }
};

module.exports = {
  getAddresses,
  getDefault,
  createAddress,
  updateAddressById,
  deleteAddressById,
  setDefault,
  validatePincode,
};