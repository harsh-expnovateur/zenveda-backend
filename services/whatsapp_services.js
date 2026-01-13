const axios = require("axios");

/* ----------------------------------
   ENV VALIDATION (FAIL FAST 🔥)
----------------------------------- */

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";

const BASE_URL = process.env.PINBOT_WHATSAPP_BASE_URL;
const SENDER_ID = process.env.PINBOT_WHATSAPP_SENDER_ID;
const API_KEY = process.env.PINBOT_WHATSAPP_API_KEY;

if (!BASE_URL || !SENDER_ID || !API_KEY) {
  throw new Error("Pinbot WhatsApp environment variables are missing");
}

/* ----------------------------------
   AXIOS CLIENT (LIKE DELHIVERY)
----------------------------------- */

const whatsappClient = axios.create({
  baseURL: `${BASE_URL}/${SENDER_ID}`,
  headers: {
    apikey: API_KEY,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/* ----------------------------------
   TEMPLATE WHITELIST (ANTI-HACK)
----------------------------------- */
/**
 * Only these templates can ever be sent.
 * Frontend can NEVER choose template names.
 */
const TEMPLATE_MAP = Object.freeze({
  PAYMENT_PENDING: "payment_pending",
  PAYMENT_RECEIVED: "payment_confirm",
  DELIVERED: "delivery",
  // REORDER: "nudg1",
  // DISCOVER_BLEND: "nudge2",
  // add more safely here later
});

/* ----------------------------------
   CORE SEND FUNCTION
----------------------------------- */
/**
 * @param {string} phone - 91XXXXXXXXXX
 * @param {string} event - REORDER | DISCOVER_BLEND
 */
const sendTemplateMessage = async ({ phone, event }) => {
  if (!WHATSAPP_ENABLED) {
    logger.info("WhatsApp sending disabled by ENV flag");
    return; // ✅ No API call, no charge
  }

  if (!phone || !event) {
    throw new Error("phone and event are required");
  }

  const templateName = TEMPLATE_MAP[event];
  if (!templateName) {
    logger.warn("WhatsApp template disabled or not mapped", { event });
    return; // ✅ STOP silently, no API call, no charge
  }

  try {
    const response = await whatsappClient.post("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" }, // must match BSP approval
        components: [],
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "WhatsApp Pinbot API Error:",
      error.response?.data || error.message
    );

    // Masked error (no secrets leak)
    throw new Error("WhatsApp message sending failed");
  }
};

/* ----------------------------------
   EXPORTS
----------------------------------- */

module.exports = {
  sendTemplateMessage,
  TEMPLATE_MAP, // optional (for testing/logs only)
};
