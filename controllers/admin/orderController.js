// controllers/admin/orderController.js
const { getPool, mssql } = require("../../config/db");

const {
  getAllOrders: getAllOrdersModel,
  getOrderById,
  updateOrderStatus: updateOrderStatusModel,
  createShipment: createShipmentModel,
  getShipmentByOrderId,
} = require("../../models/admin/orderModel");
const {
  upsertShipmentLabel,
} = require("../../models/admin/shipmentLabelModel");
const logger = require("../../config/logger");
const { sendEmail } = require("../../utils/mailer");
const {
  orderShippedTemplate,
  orderDeliveredTemplate,
  orderCancelledTemplate,
} = require("../../utils/emailTemplates");
const {
  cancelDelhiveryShipment,
  createDelhiveryShipment,
  fetchSingleWaybill,
  trackShipment,
  generatePackingSlip,
} = require("../../services/delhivery_services");
const { sendTemplateMessage } = require("../../services/whatsapp_services");

// Normalize phone to 91XXXXXXXXXX format
function normalizePhone(phone) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12) return digits;

  return null;
}

/**
 * Get all orders for admin
 */
const getAllOrders = async (req, res) => {
  try {
    const orders = await getAllOrdersModel();

    res.json({
      success: true,
      orders,
    });
  } catch (err) {
    logger.error("Get all orders error", {
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
 * Update order status
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ["Pending", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    // Get order details before updating
    const orderDetails = await getOrderById(parseInt(orderId));
    if (!orderDetails) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Update status
    await updateOrderStatusModel(parseInt(orderId), status, null, status === "Delivered" ? new Date() : null);

    // Send email notification based on status (non-blocking)
    sendStatusEmail(orderDetails, status).catch((err) => {
      logger.error("Failed to send status email", {
        orderId,
        status,
        error: err.message,
      });
    });

    // 📲 WhatsApp ONLY when Delivered (non-blocking)
    if (status === "Delivered") {
      console.log("🔔 WhatsApp trigger started for Delivered");
      try {
        const phone = normalizePhone(orderDetails.order.customer_phone);
        console.log("📞 Normalized phone:", phone);

        if (phone) {
          sendTemplateMessage({
            phone,
            event: "DELIVERED",
          }).catch((err) => {
            logger.error("WhatsApp DELIVERED failed", {
              orderId,
              error: err.message,
            });
          });
        }
      } catch (err) {
        logger.error("WhatsApp trigger error", {
          orderId,
          error: err.message,
        });
      }
    }

    logger.info("Order status updated", {
      orderId,
      status,
      adminId: req.user.id,
    });

    res.json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (err) {
    logger.error("Update order status error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to update order status",
    });
  }
};

/**
 * Update payment status
 */
const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { payment_status } = req.body;

    const validPaymentStatuses = ["unpaid", "paid"];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment status",
      });
    }

    await updateOrderStatusModel(parseInt(orderId), null, payment_status);

    const orderDetails = await getOrderById(parseInt(orderId));

    if (payment_status === "paid") {
      // 📲 WhatsApp Payment Received (non-blocking)
      console.log("🔔 WhatsApp trigger started for Payment Received");
      try {
        const phone = normalizePhone(orderDetails.order.customer_phone);

         if (phone) {
          sendTemplateMessage({
            phone,
            event: "PAYMENT_RECEIVED", // ✅ second WhatsApp template
          });
        } else {
          logger.error("WhatsApp skipped: invalid phone", {
            orderId,
            rawPhone,
          });
        }
      } catch (err) {
        logger.error("WhatsApp PAYMENT_RECEIVED failed", {
          orderId,
          error: err.message,
        });
      }
    }

    logger.info("Order payment status updated", {
      orderId,
      payment_status,
      adminId: req.user.id,
    });

    res.json({
      success: true,
      message: "Payment status updated successfully",
    });
  } catch (err) {
    logger.error("Update payment status error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to update payment status",
    });
  }
};

/**
 * Create shipment for an order
 */
// const createShipment = async (req, res) => {
//   try {
//     const { orderId } = req.params;

//     // Check if order exists
//     const orderDetails = await getOrderById(parseInt(orderId));
//     if (!orderDetails) {
//       return res.status(404).json({
//         success: false,
//         error: "Order not found",
//       });
//     }

//     // Check if shipment already exists
//     const existingShipment = await getShipmentByOrderId(parseInt(orderId));
//     if (existingShipment) {
//       return res.status(400).json({
//         success: false,
//         error: "Shipment already exists for this order",
//         shipment: existingShipment,
//       });
//     }

//     // Fetch AWB from Delhivery
//     logger.info("Fetching AWB from Delhivery", { orderId });
//     const waybillResponse = await fetchSingleWaybill();

//     // Extract AWB from response
//     let awb;
//     if (typeof waybillResponse === "string") {
//       awb = waybillResponse.replace(/['"]/g, ""); // Remove quotes if present
//     } else if (waybillResponse.waybill) {
//       awb = waybillResponse.waybill;
//     } else {
//       throw new Error("Invalid waybill response format");
//     }

//     if (!awb) {
//       throw new Error("Failed to generate AWB");
//     }

//     // Create tracking URL (Delhivery format)
//     const trackingUrl = `https://www.delhivery.com/track/package/${awb}`;

//     // Save shipment to database
//     const shipment = await createShipmentModel(parseInt(orderId), awb, trackingUrl);

//     logger.info("Shipment created successfully", {
//       orderId,
//       awb,
//       shipmentId: shipment.shipment_id,
//       adminId: req.user.id,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Shipment created successfully",
//       shipment: {
//         shipmentId: shipment.shipment_id,
//         awb: shipment.awb,
//         shipmentStatus: shipment.shipment_status,
//         trackingUrl,
//       },
//     });
//   } catch (err) {
//     logger.error("Create shipment error", {
//       message: err.message,
//       stack: err.stack,
//       orderId: req.params.orderId,
//     });

//     res.status(500).json({
//       success: false,
//       error: err.message || "Failed to create shipment",
//     });
//   }
// };

/**
 * Create shipment for an order (Delhivery + DB save)
 */
const createShipment = async (req, res) => {
  try {
    const { orderId } = req.params;

    // --- 1. Fetch Order ---
    const orderDetails = await getOrderById(parseInt(orderId));
    if (!orderDetails) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // --- 2. Check if shipment exists ---
    const existingShipment = await getShipmentByOrderId(orderId);
    if (existingShipment) {
      return res.status(400).json({
        success: false,
        error: "Shipment already exists",
        shipment: existingShipment,
      });
    }

    // --- 3. Get AWB from Delhivery ---
    const awbRes = await fetchSingleWaybill();
    const awb =
      awbRes?.waybill || awbRes?.wbns || String(awbRes).replace(/['"]/g, "");
    if (!awb) throw new Error("Failed to generate AWB");

    // --- 4. Build Delhivery Payload ---
    const order = orderDetails.order;

    const payload = {
      shipments: [
        {
          name: order.customer_name,
          add: order.shipping_address,
          pin: order.shipping_pincode,
          city: order.shipping_city,
          state: order.shipping_state,
          country: "India",
          phone: order.customer_phone,
          order: order.order_number,
          waybill: awb,
          shipment_width: 10,
          shipment_height: 10,
          weight: 500,
          products_desc: "Order items",
          payment_mode: order.payment_status === "paid" ? "Prepaid" : "COD",
          cod_amount: order.payment_status === "paid" ? 0 : order.total_amount,
        },
      ],
      pickup_location: {
        name: process.env.DELHIVERY_WAREHOUSE_NAME,
      },
    };

    // --- 5. Call Delhivery Shipment Create API ---
    let delhiveryResult;
    try {
      delhiveryResult = await createDelhiveryShipment(payload);
    } catch (apiErr) {
      delhiveryResult = { error: true, details: apiErr.message };
    }

    // --- 6. Insert into DB ---
    const createdShipment = await createShipmentModel(
      orderId,
      awb,
      `https://www.delhivery.com/track/package/${awb}`
    );

    // Log request/response
    const pool = await getPool();
    await pool
      .request()
      .input("shipment_id", mssql.Int, createdShipment.shipment_id)
      .input("request", mssql.NVarChar(mssql.MAX), JSON.stringify(payload))
      .input(
        "response",
        mssql.NVarChar(mssql.MAX),
        JSON.stringify(delhiveryResult)
      )
      .input("success", mssql.Bit, delhiveryResult?.success === true).query(`
        UPDATE shipments 
        SET delhivery_request = @request,
            delhivery_response = @response,
            is_success = @success
        WHERE shipment_id = @shipment_id
      `);

    // --- 7. Response to frontend (safe) ---
    return res.status(201).json({
      success: true,
      message: "Shipment created (Delhivery response logged).",
      shipment: {
        shipmentId: createdShipment.shipment_id,
        awb,
        trackingUrl: `https://www.delhivery.com/track/package/${awb}`,
        delhiveryStatus: delhiveryResult,
      },
    });
  } catch (err) {
    console.error("Shipment create error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Cancel Shipment (Admin)
 */
const cancelShipment = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Fetch order
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Get shipment
    const shipment = await getShipmentByOrderId(orderId);
    if (!shipment) {
      return res.status(400).json({
        success: false,
        error: "Shipment not found for this order",
      });
    }

    const waybill = shipment.awb;

    // Call Delhivery API
    let delhiveryResp;
    try {
      delhiveryResp = await cancelDelhiveryShipment(waybill);
    } catch (err) {
      delhiveryResp = { error: true, details: err.message };
    }

    // Update DB
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

    // Also update order table
    await updateOrderStatusModel(orderId, "Cancelled", null);

    return res.json({
      success: true,
      message: "Shipment cancelled successfully",
      delhivery: delhiveryResp,
    });
  } catch (err) {
    console.error("Cancel Shipment Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Track Shipment (Admin)
 */
const getShipmentTracking = async (req, res) => {
  try {
    const { orderId } = req.params;

    const shipment = await getShipmentByOrderId(orderId);
    if (!shipment || !shipment.awb) {
      return res.status(404).json({
        success: false,
        error: "No shipment found",
      });
    }

    const trackingData = await trackShipment(shipment.awb, orderId);

    res.json({
      success: true,
      tracking: trackingData,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Send email based on status change (async)
 */
async function sendStatusEmail(orderDetails, status) {
  const { order, items } = orderDetails;

  let subject = "";
  let template = null;

  const emailData = {
    customerName: order.customer_name,
    orderNumber: order.order_number,
    subtotal_amount: order.subtotal_amount,
    totalAmount: parseFloat(order.total_amount).toFixed(2),
    items: items,
    shippingAddress: {
      address: order.shipping_address,
      city: order.shipping_city,
      state: order.shipping_state,
      pincode: order.shipping_pincode,
    },
  };

  switch (status) {
    case "Shipped":
      subject = `Order Shipped - ${order.order_number}`;
      template = orderShippedTemplate(emailData);
      break;
    case "Delivered":
      subject = `Order Delivered - ${order.order_number}`;
      template = orderDeliveredTemplate(emailData);
      break;
    case "Cancelled":
      subject = `Order Cancelled - ${order.order_number}`;
      template = orderCancelledTemplate(emailData);
      break;
    default:
      return; // Don't send email for Pending status
  }

  if (template) {
    await sendEmail({
      to: order.customer_email,
      subject: subject,
      html: template,
    });
  }
}

/**
 * Generate shipment label
 */
const generateShipmentLabel = async (req, res) => {
  try {
    const { orderId } = req.params;

    const shipment = await getShipmentByOrderId(orderId);
    if (!shipment || !shipment.awb) {
      return res.status(400).json({
        success: false,
        error: "Shipment not found",
      });
    }

    let apiResponse;

    try {
      apiResponse = await generatePackingSlip(shipment.awb, true, "4R");
    } catch (err) {
      apiResponse = {
        packages_found: 0,
        error: err.message,
      };
    }

    await upsertShipmentLabel({
      shipmentId: shipment.shipment_id,
      orderId,
      awb: shipment.awb,
      response: apiResponse,
    });

    return res.json({
      success: true,
      label: apiResponse,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const pool = await getPool();

    // Total Sales (sum of all order amounts)
    const salesResult = await pool.query(`
      SELECT ISNULL(SUM(total_amount), 0) as total_sales
      FROM orders
      WHERE status != 'Cancelled'
    `);

    // Total Orders
    const ordersResult = await pool.query(`
      SELECT COUNT(*) as total_orders
      FROM orders
    `);

    // Pending Orders
    const pendingResult = await pool.query(`
      SELECT COUNT(*) as pending_count
      FROM orders
      WHERE status = 'Pending'
    `);

    // Cancelled Orders
    const cancelledResult = await pool.query(`
      SELECT COUNT(*) as cancelled_count
      FROM orders
      WHERE status = 'Cancelled'
    `);

    // Calculate percentage changes (comparing with previous period)
    const salesChangeResult = await pool.query(`
      SELECT 
        ISNULL(SUM(CASE 
          WHEN MONTH(order_date) = MONTH(GETDATE()) 
          AND YEAR(order_date) = YEAR(GETDATE()) 
          THEN total_amount ELSE 0 END), 0) as current_month_sales,
        ISNULL(SUM(CASE 
          WHEN MONTH(order_date) = MONTH(DATEADD(MONTH, -1, GETDATE())) 
          AND YEAR(order_date) = YEAR(DATEADD(MONTH, -1, GETDATE())) 
          THEN total_amount ELSE 0 END), 0) as previous_month_sales
      FROM orders
      WHERE status != 'Cancelled'
    `);

    const ordersChangeResult = await pool.query(`
      SELECT 
        COUNT(CASE 
          WHEN MONTH(order_date) = MONTH(GETDATE()) 
          AND YEAR(order_date) = YEAR(GETDATE()) 
          THEN 1 END) as current_month_orders,
        COUNT(CASE 
          WHEN MONTH(order_date) = MONTH(DATEADD(MONTH, -1, GETDATE())) 
          AND YEAR(order_date) = YEAR(DATEADD(MONTH, -1, GETDATE())) 
          THEN 1 END) as previous_month_orders
      FROM orders
    `);

    const totalSales = parseFloat(salesResult.recordset[0].total_sales);
    const totalOrders = ordersResult.recordset[0].total_orders;
    const pendingCount = pendingResult.recordset[0].pending_count;
    const cancelledCount = cancelledResult.recordset[0].cancelled_count;

    const currentMonthSales = parseFloat(
      salesChangeResult.recordset[0].current_month_sales
    );
    const previousMonthSales = parseFloat(
      salesChangeResult.recordset[0].previous_month_sales
    );
    let salesChange = 0;
    if (previousMonthSales > 0) {
      salesChange =
        ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100;
    } else if (currentMonthSales > 0) {
      salesChange = 100;
    }

    const currentMonthOrders =
      ordersChangeResult.recordset[0].current_month_orders;
    const previousMonthOrders =
      ordersChangeResult.recordset[0].previous_month_orders;
    let ordersChange = 0;
    if (previousMonthOrders > 0) {
      ordersChange =
        ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) *
        100;
    } else if (currentMonthOrders > 0) {
      ordersChange = 100;
    }

    const previousPendingResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE status = 'Pending'
      AND MONTH(order_date) = MONTH(DATEADD(MONTH, -1, GETDATE()))
      AND YEAR(order_date) = YEAR(DATEADD(MONTH, -1, GETDATE()))
    `);

    const previousCancelledResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE status = 'Cancelled'
      AND MONTH(order_date) = MONTH(DATEADD(MONTH, -1, GETDATE()))
      AND YEAR(order_date) = YEAR(DATEADD(MONTH, -1, GETDATE()))
    `);

    const currentPendingCancelled = pendingCount + cancelledCount;
    const previousPendingCancelled =
      previousPendingResult.recordset[0].count +
      previousCancelledResult.recordset[0].count;
    let pendingCancelledChange = 0;
    if (previousPendingCancelled > 0) {
      pendingCancelledChange =
        ((currentPendingCancelled - previousPendingCancelled) /
          previousPendingCancelled) *
        100;
    } else if (currentPendingCancelled > 0) {
      pendingCancelledChange = 100;
    }

    res.json({
      success: true,
      stats: {
        totalSales,
        salesChange: salesChange.toFixed(1),
        totalOrders,
        ordersChange: ordersChange.toFixed(1),
        pendingCount,
        cancelledCount,
        pendingCancelledChange: pendingCancelledChange.toFixed(1),
      },
    });
  } catch (err) {
    logger.error("Get dashboard stats error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics",
    });
  }
};

/**
 * Get monthly sales data for selected financial year
 */
const getMonthlySalesData = async (req, res) => {
  try {
    const pool = await getPool();
    const { fy } = req.query;

    let startDate, endDate;

    if (fy) {
      const [startYear, endYearShort] = fy.split("-");
      const endYear = Number(`20${endYearShort}`);

      startDate = new Date(`${startYear}-04-01`);
      endDate = new Date(`${endYear}-04-01`);
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const fyStartYear = month >= 3 ? year : year - 1;

      startDate = new Date(`${fyStartYear}-04-01`);
      endDate = new Date(`${fyStartYear + 1}-04-01`);
    }

    const result = await pool
      .request()
      .input("startDate", startDate) // ✅ Date object
      .input("endDate", endDate)     // ✅ Date object
      .query(`
        SELECT 
          MONTH(order_date) AS month_num,
          YEAR(order_date) AS year,
          SUM(total_amount) AS total_sales
        FROM orders
        WHERE order_date >= @startDate
          AND order_date < @endDate
          AND status != 'Cancelled'
        GROUP BY MONTH(order_date), YEAR(order_date)
        ORDER BY YEAR(order_date), MONTH(order_date)
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error("Get monthly sales data error", err);
    res.status(500).json({ success: false });
  }
};




module.exports = {
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  createShipment,
  cancelShipment,
  getShipmentTracking,
  generateShipmentLabel,
  getDashboardStats,
  getMonthlySalesData,
};
