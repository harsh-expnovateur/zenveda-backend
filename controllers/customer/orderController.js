// controllers/customer/orderController.js
const {
  createOrder,
  addOrderItems,
  saveTATQuery,
  getCustomerOrders,
  getOrderDetails,
  updateOrderStatus,
  saveShippingCharge,
} = require("../../models/customer/orderModel");
const { getCartItems, clearCart } = require("../../models/customer/cartModel");
const logger = require("../../config/logger");
const { sendEmail } = require("../../utils/mailer");
const {
  customerTemplate,
  adminTemplate,
} = require("../../utils/emailTemplates");
const {
  getExpectedTAT,
  cancelDelhiveryShipment,
  trackShipment,
  calculateShippingCharges,
} = require("../../services/delhivery_services");
const { sendTemplateMessage } = require("../../services/whatsapp_services");
const { getShipmentByOrderId } = require("../../models/admin/orderModel");
const { getPool, mssql } = require("../../config/db");

/**
 * Calculate expected delivery date
 */
function calculateExpectedDeliveryDate(tatDays, pickupDate = new Date()) {
  const deliveryDate = new Date(pickupDate);
  deliveryDate.setDate(deliveryDate.getDate() + tatDays);
  return deliveryDate;
}

/**
 * Calculate total weight from cart items
 */
function calculateCartWeight(cartItems) {
  // Default weight per item if not available (in grams)
  const DEFAULT_WEIGHT = 100;

  return cartItems.reduce((total, item) => {
    const itemWeight = item.package_weight || DEFAULT_WEIGHT;
    return total + itemWeight * item.quantity;
  }, 0);
}

/**
 * Normalize phone number to 91XXXXXXXXXX format
 */
function normalizePhone(phone) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12) return digits;

  return null;
}


/**
 * Create order from cart
 */
const placeOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      shippingAddress,
      shippingCity,
      shippingState,
      shippingPincode,
      customerName,
      customerPhone,
      customerEmail,
      appliedDiscountId,
      discountAmount = 0,
    } = req.body;

    if (
      !shippingAddress ||
      !shippingCity ||
      !shippingState ||
      !shippingPincode ||
      !customerName ||
      !customerPhone
    ) {
      return res.status(400).json({
        success: false,
        error: "All shipping details are required",
      });
    }

    const cartItems = await getCartItems(customerId);
    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Cart is empty",
      });
    }

    const subtotalAmount = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.selling_price) * item.quantity,
      0
    );

    const safeDiscountAmount = Math.min(discountAmount, subtotalAmount);

    const finalAmount = subtotalAmount - safeDiscountAmount;

    const order = await createOrder({
      customerId,
      totalAmount: finalAmount,
      subtotalAmount: subtotalAmount,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingPincode,
      customerName,
      customerPhone,
      customerEmail: customerEmail || req.user.email,

      safeDiscountAmount: safeDiscountAmount,
      discountId: appliedDiscountId ?? null,
    });

    const orderItems = cartItems.map((item) => ({
      tea_id: item.tea_id,
      package_id: item.package_id,
      tea_name: item.tea_name,
      package_name: item.package_name,
      quantity: item.quantity,
      price_per_unit: parseFloat(item.selling_price),
      subtotal: parseFloat(item.selling_price) * item.quantity,
    }));

    await addOrderItems(order.order_id, orderItems);

    // Calculate & Save Shipping Charges
    const originPin = process.env.ORIGIN_PINCODE || "122004";
    const cartWeight = calculateCartWeight(cartItems);

    let savedShippingCharge = null;

    try {
      const shippingCharges = await calculateShippingCharges({
        mode: "E",
        originPin: originPin,
        destinationPin: shippingPincode,
        weightGrams: cartWeight,
        paymentType: "Pre-paid",
        orderStatus: "Delivered",
      });

      if (shippingCharges && !shippingCharges.error) {
        await saveShippingCharge({
          orderId: order.order_id,
          shipmentId: null,
          api: shippingCharges,
        });

        savedShippingCharge = shippingCharges.total_amount || 0;

        logger.info("Shipping charges saved", {
          orderId: order.order_id,
          totalAmount: savedShippingCharge,
        });
      }
    } catch (err) {
      logger.error("Shipping charge save failed", {
        error: err.message,
        orderId: order.order_id,
      });
    }

    // Fetch TAT from Delhivery API (non-blocking)
    const today = new Date();
    const expectedPickupDate = new Date(today);
    expectedPickupDate.setDate(today.getDate() + 1);

    const yyyy = expectedPickupDate.getFullYear();
    const mm = String(expectedPickupDate.getMonth() + 1).padStart(2, "0");
    const dd = String(expectedPickupDate.getDate()).padStart(2, "0");
    const pickupDateStr = `${yyyy}-${mm}-${dd} 00:00`;

    getExpectedTAT(shippingPincode, originPin, "S", "B2C", pickupDateStr)
      .then((tatResponse) => {
        if (tatResponse.success && tatResponse.data && tatResponse.data.tat) {
          const tatDays = tatResponse.data.tat;
          const expectedDeliveryDate = calculateExpectedDeliveryDate(
            tatDays,
            expectedPickupDate
          );

          saveTATQuery({
            orderId: order.order_id,
            originPin,
            destinationPin: shippingPincode,
            mot: "S",
            pdt: "B2C",
            expectedPickupDate,
            tatDays,
            expectedDeliveryDate,
            rawResponse: JSON.stringify(tatResponse),
          }).catch((err) => {
            logger.error("Failed to save TAT query", { error: err.message });
          });

          logger.info("TAT fetched successfully", {
            orderId: order.order_id,
            tatDays,
            expectedDeliveryDate,
          });
        }
      })
      .catch((err) => {
        logger.error("Failed to fetch TAT from Delhivery", {
          error: err.message,
          orderId: order.order_id,
        });
      });

    await clearCart(customerId);

    const orderDataForEmail = {
      customerName: customerName,
      orderNumber: order.order_number,
      totalAmount: finalAmount.toFixed(2),
      customerEmail: customerEmail || req.user.email,
      items: orderItems,
      shippingAddress: {
        address: shippingAddress,
        city: shippingCity,
        state: shippingState,
        pincode: shippingPincode,
      },
    };

    sendEmail({
      to: orderDataForEmail.customerEmail,
      subject: `Order Confirmation - ${orderDataForEmail.orderNumber}`,
      html: customerTemplate(orderDataForEmail),
    }).catch((err) => {
      logger.error("Failed to send customer email", { error: err.message });
    });

    sendEmail({
      to: process.env.ADMIN_EMAIL || "admin@yourstore.com",
      subject: `New Order Received - ${orderDataForEmail.orderNumber}`,
      html: adminTemplate(orderDataForEmail),
    }).catch((err) => {
      logger.error("Failed to send admin email", { error: err.message });
    });

    // --------------------
    // WhatsApp: PAYMENT_PENDING (non-blocking)
    // --------------------
    try {
      const whatsappPhone = normalizePhone(customerPhone);

      if (whatsappPhone) {
        sendTemplateMessage({
          phone: whatsappPhone,
          event: "PAYMENT_PENDING",
        }).catch((err) => {
          logger.error("WhatsApp PAYMENT_PENDING failed", {
            orderId: order.order_id,
            error: err.message,
          });
        });
      }
    } catch (err) {
      logger.error("WhatsApp trigger error", {
        orderId: order.order_id,
        error: err.message,
      });
    }

    logger.info("Order placed successfully", {
      customerId,
      orderId: order.order_id,
      orderNumber: order.order_number,
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: {
        orderId: order.order_id,
        orderNumber: order.order_number,
        totalAmount: finalAmount,
        shippingCharge: savedShippingCharge,
      },
    });
  } catch (err) {
    logger.error("Place order error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to place order",
    });
  }
};

/**
 * Get customer orders
 */
const getOrders = async (req, res) => {
  try {
    const customerId = req.user.id;
    const orders = await getCustomerOrders(customerId);

    res.json({
      success: true,
      orders,
    });
  } catch (err) {
    logger.error("Get orders error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch orders",
    });
  }
};

/**
 * Get order details
 */
const getOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { orderId } = req.params;

    const orderData = await getOrderDetails(parseInt(orderId), customerId);
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.json({
      success: true,
      order: orderData,
    });
  } catch (err) {
    logger.error("Get order details error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch order details",
    });
  }
};

/**
 * Customer cancels an order
 */
const cancelOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { orderId } = req.params;

    const orderData = await getOrderDetails(parseInt(orderId), customerId);
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const order = orderData.order;

    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Order cannot be cancelled because it is already ${order.status}`,
      });
    }

    const shipment = await getShipmentByOrderId(orderId);
    let delhiveryResp = null;

    if (shipment?.awb) {
      const waybill = shipment.awb;

      try {
        delhiveryResp = await cancelDelhiveryShipment(waybill);
      } catch (err) {
        delhiveryResp = { error: true, details: err.message };
      }

      const pool = await getPool();
      await pool
        .request()
        .input("shipment_id", mssql.Int, shipment.shipment_id)
        .input("status", mssql.VarChar(50), "Cancelled")
        .input(
          "response",
          mssql.NVarChar(mssql.MAX),
          JSON.stringify(delhiveryResp)
        ).query(`
          UPDATE shipments
          SET shipment_status = @status,
              delhivery_response = @response,
              updated_at = GETDATE()
          WHERE shipment_id = @shipment_id
        `);
    }

    await updateOrderStatus(orderId, "Cancelled");

    res.json({
      success: true,
      message: "Order cancelled successfully",
      delhivery: delhiveryResp,
    });
  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Track Shipment (Customer)
 */
const getShipmentTrackingCustomer = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.id;

    const order = await getOrderDetails(orderId, customerId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const shipment = await getShipmentByOrderId(orderId);
    if (!shipment) {
      return res.status(400).json({
        success: false,
        error: "Shipment not created yet",
      });
    }

    const tracking = await trackShipment(shipment.awb, orderId);

    res.json({
      success: true,
      currentStatus: tracking?.ShipmentData?.[0]?.Status,
      history: tracking?.ShipmentData?.[0]?.Scans,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Calculate Shipping Charges (Customer) - For Preview
 */
const getShippingChargeCustomer = async (req, res) => {
  try {
    const { pincode } = req.params;
    const originPin = process.env.ORIGIN_PINCODE || "122004";

    const shippingCharge = await calculateShippingCharges({
      mode: "E",
      weightGrams: 500,
      originPin,
      destinationPin: pincode,
      orderStatus: "Delivered",
      paymentType: "Pre-paid",
    });

    if (!shippingCharge || shippingCharge.error) {
      return res.json({
        success: false,
        error: shippingCharge?.message || "No data returned from Delhivery",
      });
    }

    res.json({
      success: true,
      charge: shippingCharge.total_amount,
      details: shippingCharge,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || "Failed to calculate charges",
    });
  }
};

module.exports = {
  placeOrder,
  getOrders,
  getOrder,
  cancelOrder,
  getShipmentTrackingCustomer,
  getShippingChargeCustomer,
};
