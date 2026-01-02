// models/admin/orderModel.js
const { getPool, mssql } = require("../../config/db");

/**
 * Get all orders (admin view) with shipment details
 */
async function getAllOrders() {
  const pool = await getPool();
  const result = await pool.query(`
    SELECT 
      o.order_id,
      o.customer_id,
      o.order_number,
      o.total_amount,
      o.status,
      o.payment_status,
      o.order_date,
      o.shipping_address,
      o.shipping_city,
      o.shipping_state,
      o.shipping_pincode,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.created_at,
      o.updated_at,

      -- Shipment fields
      s.shipment_id,
      s.awb,
      s.shipment_status,
      s.tracking_url,
      s.is_success,
      s.delhivery_request,
      s.delhivery_response,

      sl.pdf_url AS label_pdf,
      sl.status AS label_status

    FROM orders o
    LEFT JOIN shipments s ON o.order_id = s.order_id
    LEFT JOIN shipment_labels sl ON sl.shipment_id = s.shipment_id
    ORDER BY o.order_date DESC
  `);

  return result.recordset;
}

/**
 * Get order by ID with items
 */
async function getOrderById(orderId) {
  const pool = await getPool();

  // Fetch order
  const orderResult = await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .query(`
      SELECT *
      FROM orders
      WHERE order_id = @order_id
    `);

  if (orderResult.recordset.length === 0) return null;

  // Fetch items
  const itemsResult = await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .query(`
      SELECT *
      FROM order_items
      WHERE order_id = @order_id
    `);

  return {
    order: orderResult.recordset[0],
    items: itemsResult.recordset,
  };
}

/**
 * Update order status and/or payment status
 */
async function updateOrderStatus(orderId, status = null, paymentStatus = null, deliveredAt = null) {
  const pool = await getPool();

  let query = "UPDATE orders SET updated_at = SYSUTCDATETIME()";
  const params = [];

  if (status !== null) {
    query += ", status = @status";
    params.push({ name: "status", type: mssql.NVarChar(50), value: status });
  }

  if (paymentStatus !== null) {
    query += ", payment_status = @payment_status";
    params.push({
      name: "payment_status",
      type: mssql.NVarChar(50),
      value: paymentStatus,
    });
  }

  if (deliveredAt !== null) {
    query += ", delivered_at = @delivered_at";
    params.push({
      name: "delivered_at",
      type: mssql.DateTime2,
      value: deliveredAt,
    });
  }

  query += " WHERE order_id = @order_id";

  const request = pool.request().input("order_id", mssql.Int, orderId);

  params.forEach((p) => request.input(p.name, p.type, p.value));

  await request.query(query);
}

/**
 * Create shipment record
 */
async function createShipment(orderId, awb, trackingUrl, requestData, responseData, isSuccess) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .input("awb", mssql.VarChar(50), awb)
    .input("tracking_url", mssql.VarChar(250), trackingUrl)
    .input("delhivery_request", mssql.NVarChar(mssql.MAX), requestData)
    .input("delhivery_response", mssql.NVarChar(mssql.MAX), responseData)
    .input("is_success", mssql.Bit, isSuccess)
    .query(`
      INSERT INTO shipments (
        order_id, awb, shipment_status, tracking_url,
        delhivery_request, delhivery_response, is_success
      )
      OUTPUT INSERTED.*
      VALUES (
        @order_id, @awb, 'Created', @tracking_url,
        @delhivery_request, @delhivery_response, @is_success
      )
    `);

  return result.recordset[0];
}

/**
 * Get shipment by order ID
 */
async function getShipmentByOrderId(orderId) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .query(`
      SELECT *
      FROM shipments
      WHERE order_id = @order_id
    `);

  return result.recordset[0] || null;
}

/**
 * Update shipment status
 */
async function updateShipmentStatus(shipmentId, status) {
  const pool = await getPool();

  await pool
    .request()
    .input("shipment_id", mssql.Int, shipmentId)
    .input("shipment_status", mssql.VarChar(50), status)
    .query(`
      UPDATE shipments
      SET shipment_status = @shipment_status,
          updated_at = GETDATE()
      WHERE shipment_id = @shipment_id
    `);
}

module.exports = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  createShipment,
  getShipmentByOrderId,
  updateShipmentStatus,
};
