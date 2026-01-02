const axios = require("axios");
const qs = require("querystring"); // Add this at top (Node built-in)

const DELHIVERY_BASE_URL = process.env.DELHIVERY_BASE_URL;
const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN;

if (!DELHIVERY_BASE_URL || !DELHIVERY_TOKEN) {
  throw new Error("Delhivery environment variables are missing");
}

const delhiveryClient = axios.create({
  baseURL: DELHIVERY_BASE_URL,
  headers: {
    Authorization: `Token ${DELHIVERY_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/**
 * Check pincode serviceability
 * @param {string|number} pincode
 * @returns {Promise<Object>}
 */
const checkPincodeServiceability = async (pincode) => {
  if (!pincode) {
    throw new Error("Pincode is required");
  }

  try {
    const response = await delhiveryClient.get("c/api/pin-codes/json/", {
      params: {
        filter_codes: pincode,
      },
    });

    return response.data;
  } catch (error) {
    const message =
      error.response?.data ||
      error.message ||
      "Failed to fetch pincode serviceability";

    throw new Error(message);
  }
};

/**
 * Get Expected TAT from Delhivery
 * @param {string} destinationPin
 * @param {string} originPin
 * @param {string} mot - Mode of transport (S/E) default S
 * @param {string} pdt - Product type (B2B/B2C) default B2C
 * @param {string} expectedPickupDate - Optional: YYYY-MM-DD, auto-set to tomorrow
 * @returns {Promise<Object>}
 */
const getExpectedTAT = async (
  destinationPin,
  originPin,
  mot = "S",
  pdt = "B2C",
  expectedPickupDate = null
) => {
  if (!destinationPin || !originPin) {
    throw new Error("Origin and Destination pins are required");
  }

  // Generate expected pickup date in correct format: YYYY-MM-DD HH:MM
  let formattedDate = expectedPickupDate;
  
  if (!formattedDate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");

    formattedDate = `${yyyy}-${mm}-${dd} 00:00`;
  } else if (formattedDate.length === 10) {
    // If only date is provided (YYYY-MM-DD), add time
    formattedDate = `${formattedDate} 00:00`;
  }

  try {
    const response = await delhiveryClient.get("api/dc/expected_tat", {
      params: {
        origin_pin: originPin,
        destination_pin: destinationPin,
        mot,
        pdt,
        expected_pickup_date: formattedDate,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Delhivery TAT API Error:", error.response?.data || error.message);

    const message =
      error.response?.data?.msg ||
      error.response?.data ||
      error.message ||
      "Failed to fetch expected TAT";

    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
};

/**
 * Fetch Single Waybill from Delhivery
 * @param {string} awb - optional prefilled AWB (not mandatory, Delhivery can generate)
 * @returns {Promise<Object>}
 */
const fetchSingleWaybill = async () => {
  try {
    const response = await delhiveryClient.get("waybill/api/fetch/json/", {
      params: { token: DELHIVERY_TOKEN },
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data ||
      error.message ||
      "Failed to fetch single waybill";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
};

/**
 * Create Shipment in Delhivery (CMU API)
 */
const createDelhiveryShipment = async (payload) => {
  try {
    // Convert payload → format=json&data={...json...}
    const requestBody = qs.stringify({
      format: "json",
      data: JSON.stringify(payload)
    });

    const response = await delhiveryClient.post(
      "api/cmu/create.json",
      requestBody,
      {
        headers: {
          Authorization: `Token ${DELHIVERY_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        }
      }
    );

    return response.data;

  } catch (error) {
    const message =
      error.response?.data ||
      error.message ||
      "Delhivery shipment creation failed";

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }
};

/**
 * Cancel Shipment in Delhivery (EDIT API)
 */
const cancelDelhiveryShipment = async (waybill) => {
  try {
    // Convert → format=json&data={...payload}
    const body = qs.stringify({
      format: "json",
      data: JSON.stringify({
        waybill,
        cancellation: true
      })
    });

    const response = await delhiveryClient.post(
      "api/p/edit",
      body,
      {
        headers: {
          Authorization: `Token ${DELHIVERY_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        }
      }
    );

    return response.data;

  } catch (error) {
    const message =
      error.response?.data ||
      error.message ||
      "Delhivery shipment cancellation failed";

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }
};

/**
 * Shipment Tracking in Delhivery
 */

const trackShipment = async (waybill, orderId) => {
  try {
    const res = await delhiveryClient.get(
      `api/v1/packages/json/`,
      {
        params: {
          waybill,
          ref_ids: orderId
        }
      }
    );

    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.Error || "Tracking failed");
  }
};

/**
 * Calculate Delhivery Shipping Charges
 * ⚠️ FIX: Extract first element from array response
 */
const calculateShippingCharges = async ({
  mode = "E",
  orderStatus = "Delivered",
  destinationPin,
  weightGrams = 500,
  paymentType = "Pre-paid",
}) => {
  const originPin = process.env.ORIGIN_PINCODE || "122004";

  try {
    const res = await delhiveryClient.get("/kinko/v1/invoice/charges/.json", {
      params: {
        md: mode,
        ss: orderStatus,
        o_pin: originPin,
        d_pin: destinationPin,
        cgm: weightGrams,
        pt: paymentType,
      },
    });

    // ✅ FIX: Response is an array, extract first element
    const responseData = Array.isArray(res.data) ? res.data[0] : res.data;

    // If Delhivery returns empty array or invalid structure
    if (!responseData) {
      return {
        error: true,
        message: "No charge data returned",
        total_amount: 0,
      };
    }

    // ✅ Return the extracted object (not the array)
    return responseData;
  } catch (err) {
    console.error("Shipping charge API error:", err.response?.data || err.message);
    return {
      error: true,
      message: err.response?.data?.Error || "Shipping charge fetch failed",
      total_amount: 0,
    };
  }
};

/**
 * Generate Packing Slip / Shipping Label (Delhivery)
 */
const generatePackingSlip = async (awb, pdf = true, pdfSize = "4R") => {
  if (!awb) throw new Error("AWB is required");

  try {
    const response = await delhiveryClient.get(
      "api/p/packing_slip",
      {
        params: {
          wbns: awb,
          pdf: pdf,
          pdf_size: pdfSize || undefined
        },
        headers: {
          Authorization: `Token ${DELHIVERY_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    // ALWAYS return data (even if packages_found = 0)
    return response.data;

  } catch (err) {
    const message =
      err.response?.data ||
      err.message ||
      "Packing slip API failed";

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }
};



module.exports = {
  checkPincodeServiceability,
  getExpectedTAT,
  fetchSingleWaybill,
  createDelhiveryShipment,
  cancelDelhiveryShipment,
  trackShipment,
  calculateShippingCharges,
  generatePackingSlip
};