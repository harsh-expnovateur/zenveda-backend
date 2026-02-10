// models/customer/orderModel.js
const { getPool, mssql } = require("../../config/db");

const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
const str = (v) => (typeof v === "string" ? v : null);

/**
 * Generate a unique order number
 */
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Create a new order record
 */
async function createOrder({
  customerId,
  totalAmount,
  shippingAddress,
  shippingCity,
  shippingState,
  shippingPincode,
  customerName,
  customerPhone,
  customerEmail,
  subtotalAmount,
  safeDiscountAmount,
  discountId,
  payableAmount,
}) {
  const pool = await getPool();
  const orderNumber = generateOrderNumber();

  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .input("order_number", mssql.NVarChar(50), orderNumber)
    .input("total_amount", mssql.Decimal(10, 2), totalAmount)
    .input("shipping_address", mssql.NVarChar(500), shippingAddress)
    .input("shipping_city", mssql.NVarChar(100), shippingCity)
    .input("shipping_state", mssql.NVarChar(100), shippingState)
    .input("shipping_pincode", mssql.NVarChar(10), shippingPincode)
    .input("customer_name", mssql.NVarChar(100), customerName)
    .input("customer_phone", mssql.NVarChar(15), customerPhone)
    .input("customer_email", mssql.NVarChar(150), customerEmail)
    .input("subtotal_amount", mssql.Decimal(10, 2), subtotalAmount)
    .input("discount_amount", mssql.Decimal(10, 2), safeDiscountAmount)
    .input("discount_id", mssql.Int, discountId ?? null)
    // .input("payable_amount", mssql.Decimal(10, 2), payableAmount)
    .query(`
      INSERT INTO orders (
        customer_id, order_number, total_amount,
        shipping_address, shipping_city, shipping_state, shipping_pincode,
        customer_name, customer_phone, customer_email, subtotal_amount, discount_amount, discount_id
      )
      OUTPUT INSERTED.order_id, INSERTED.order_number
      VALUES (
        @customer_id, @order_number, @total_amount,
        @shipping_address, @shipping_city, @shipping_state, @shipping_pincode,
        @customer_name, @customer_phone, @customer_email, @subtotal_amount, @discount_amount, @discount_id
      )
    `);

  return result.recordset[0];
}

/**
 * Add multiple order items to a given order
 */
async function addOrderItems(orderId, items) {
  const pool = await getPool();

  for (const item of items) {
    await pool
      .request()
      .input("order_id", mssql.Int, orderId)
      .input("tea_id", mssql.Int, item.tea_id)
      .input("package_id", mssql.Int, item.package_id)
      .input("tea_name", mssql.NVarChar(200), item.tea_name)
      .input("package_name", mssql.NVarChar(50), item.package_name)
      .input("quantity", mssql.Int, item.quantity)
      .input("price_per_unit", mssql.Decimal(10, 2), item.price_per_unit)
      .input("subtotal", mssql.Decimal(10, 2), item.subtotal)
      .input("is_free", mssql.Bit, item.is_free ? 1 : 0).query(`
        INSERT INTO order_items (
          order_id, tea_id, package_id, tea_name, package_name,
          quantity, price_per_unit, subtotal, is_free
        )
        VALUES (
          @order_id, @tea_id, @package_id, @tea_name, @package_name,
          @quantity, @price_per_unit, @subtotal, @is_free
        )
      `);
  }
}

/**
 * Save TAT query details to database
 */
async function saveTATQuery({
  orderId,
  originPin,
  destinationPin,
  mot,
  pdt,
  expectedPickupDate,
  tatDays,
  expectedDeliveryDate,
  rawResponse,
}) {
  const pool = await getPool();

  await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .input("origin_pin", mssql.VarChar(10), originPin)
    .input("destination_pin", mssql.VarChar(10), destinationPin)
    .input("mot", mssql.VarChar(5), mot)
    .input("pdt", mssql.VarChar(10), pdt)
    .input("expected_pickup_date", mssql.DateTime, expectedPickupDate)
    .input("tat_days", mssql.Int, tatDays)
    .input("expected_delivery_date", mssql.Date, expectedDeliveryDate)
    .input("raw_response", mssql.NVarChar(mssql.MAX), rawResponse).query(`
      INSERT INTO tat_queries (
        order_id, origin_pin, destination_pin, mot, pdt,
        expected_pickup_date, tat_days, expected_delivery_date, raw_response
      )
      VALUES (
        @order_id, @origin_pin, @destination_pin, @mot, @pdt,
        @expected_pickup_date, @tat_days, @expected_delivery_date, @raw_response
      )
    `);
}

/**
 * Get all orders for a customer with TAT data
 */
async function getCustomerOrders(customerId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId).query(`
      SELECT 
        o.order_id, o.order_number, o.total_amount, o.status, o.payment_status,
        o.order_date, o.created_at, o.updated_at,
        t.expected_delivery_date, t.tat_days,  s.awb
      FROM orders o
      LEFT JOIN tat_queries t ON o.order_id = t.order_id
      LEFT JOIN shipments s ON o.order_id = s.order_id
      WHERE o.customer_id = @customer_id
      ORDER BY o.order_date DESC
    `);
  return result.recordset;
}

/**
 * Get order details with items for a specific order
 */
async function getOrderDetails(orderId, customerId) {
  const pool = await getPool();

  const orderResult = await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .input("customer_id", mssql.Int, customerId).query(`
      SELECT 
        o.*,
        t.expected_delivery_date, t.tat_days, t.origin_pin, t.destination_pin
      FROM orders o
      LEFT JOIN tat_queries t ON o.order_id = t.order_id
      WHERE o.order_id = @order_id AND o.customer_id = @customer_id
    `);

  if (orderResult.recordset.length === 0) return null;

  const itemsResult = await pool.request().input("order_id", mssql.Int, orderId)
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
 * Update order status or payment info
 */
async function updateOrderStatus(orderId, status, paymentStatus = null) {
  const pool = await getPool();
  const query = `
    UPDATE orders
    SET status = @status,
        payment_status = ISNULL(@payment_status, payment_status),
        updated_at = SYSUTCDATETIME()
    WHERE order_id = @order_id
  `;
  await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .input("status", mssql.NVarChar(50), status)
    .input("payment_status", mssql.NVarChar(50), paymentStatus)
    .query(query);
}

/**
 * Shipment charges
 */
async function saveShippingCharge({ orderId, shipmentId = null, api }) {
  const pool = await getPool();

  await pool
    .request()
    .input("order_id", mssql.Int, orderId)
    .input("shipment_id", mssql.Int, shipmentId)

    // direct charge fields
    .input("charge_ROV", mssql.Decimal(10, 2), num(api.charge_ROV))
    .input("charge_REATTEMPT", mssql.Decimal(10, 2), num(api.charge_REATTEMPT))
    .input("charge_RTO", mssql.Decimal(10, 2), num(api.charge_RTO))
    .input("charge_MPS", mssql.Decimal(10, 2), num(api.charge_MPS))
    .input("charge_pickup", mssql.Decimal(10, 2), num(api.charge_pickup))
    .input("charge_CWH", mssql.Decimal(10, 2), num(api.charge_CWH))
    .input("charge_DEMUR", mssql.Decimal(10, 2), num(api.charge_DEMUR))
    .input("charge_AWB", mssql.Decimal(10, 2), num(api.charge_AWB))
    .input("charge_AIR", mssql.Decimal(10, 2), num(api.charge_AIR))
    .input("charge_FSC", mssql.Decimal(10, 2), num(api.charge_FSC))
    .input("charge_LABEL", mssql.Decimal(10, 2), num(api.charge_LABEL))
    .input("charge_COD", mssql.Decimal(10, 2), num(api.charge_COD))
    .input("charge_PEAK", mssql.Decimal(10, 2), num(api.charge_PEAK))
    .input("charge_POD", mssql.Decimal(10, 2), num(api.charge_POD))
    .input("charge_LM", mssql.Decimal(10, 2), num(api.charge_LM))
    .input("charge_CCOD", mssql.Decimal(10, 2), num(api.charge_CCOD))
    .input("charge_E2E", mssql.Decimal(10, 2), num(api.charge_E2E))
    .input("charge_DTO", mssql.Decimal(10, 2), num(api.charge_DTO))
    .input("charge_COVID", mssql.Decimal(10, 2), num(api.charge_COVID))
    .input("charge_DL", mssql.Decimal(10, 2), num(api.charge_DL))
    .input("charge_DPH", mssql.Decimal(10, 2), num(api.charge_DPH))
    .input("charge_FOD", mssql.Decimal(10, 2), num(api.charge_FOD))
    .input("charge_DOCUMENT", mssql.Decimal(10, 2), num(api.charge_DOCUMENT))
    .input("charge_WOD", mssql.Decimal(10, 2), num(api.charge_WOD))
    .input("charge_INS", mssql.Decimal(10, 2), num(api.charge_INS))
    .input("charge_FS", mssql.Decimal(10, 2), num(api.charge_FS))
    .input("charge_CNC", mssql.Decimal(10, 2), num(api.charge_CNC))
    .input("charge_FOV", mssql.Decimal(10, 2), num(api.charge_FOV))
    .input("charge_QC", mssql.Decimal(10, 2), num(api.charge_QC))

    // basic info
    .input("zone", mssql.VarChar(5), str(api.zone))
    .input("status", mssql.VarChar(20), str(api.status))
    .input("charged_weight", mssql.Int, api.charged_weight ?? null)
    .input("gross_amount", mssql.Decimal(10, 2), num(api.gross_amount))
    .input("total_amount", mssql.Decimal(10, 2), num(api.total_amount))

    // tax fields
    .input(
      "tax_swacch_bharat",
      mssql.Decimal(10, 2),
      num(api.tax_data?.swacch_bharat_tax),
    )
    .input("tax_IGST", mssql.Decimal(10, 2), num(api.tax_data?.IGST))
    .input("tax_SGST", mssql.Decimal(10, 2), num(api.tax_data?.SGST))
    .input("tax_service", mssql.Decimal(10, 2), num(api.tax_data?.service_tax))
    .input(
      "tax_krishi_kalyan",
      mssql.Decimal(10, 2),
      num(api.tax_data?.krishi_kalyan_cess),
    )
    .input("tax_CGST", mssql.Decimal(10, 2), num(api.tax_data?.CGST)).query(`
      INSERT INTO shipping_charges (
        order_id, shipment_id,
        charge_ROV, charge_REATTEMPT, charge_RTO, charge_MPS, charge_pickup, charge_CWH,
        charge_DEMUR, charge_AWB, charge_AIR, charge_FSC, charge_LABEL, charge_COD,
        charge_PEAK, charge_POD, charge_LM, charge_CCOD, charge_E2E, charge_DTO,
        charge_COVID, charge_DL, charge_DPH, charge_FOD, charge_DOCUMENT, charge_WOD,
        charge_INS, charge_FS, charge_CNC, charge_FOV, charge_QC,
        zone, status, charged_weight, gross_amount, total_amount,
        tax_swacch_bharat, tax_IGST, tax_SGST, tax_service, tax_krishi_kalyan, tax_CGST
      )
      VALUES (
        @order_id, @shipment_id,
        @charge_ROV, @charge_REATTEMPT, @charge_RTO, @charge_MPS, @charge_pickup, @charge_CWH,
        @charge_DEMUR, @charge_AWB, @charge_AIR, @charge_FSC, @charge_LABEL, @charge_COD,
        @charge_PEAK, @charge_POD, @charge_LM, @charge_CCOD, @charge_E2E, @charge_DTO,
        @charge_COVID, @charge_DL, @charge_DPH, @charge_FOD, @charge_DOCUMENT, @charge_WOD,
        @charge_INS, @charge_FS, @charge_CNC, @charge_FOV, @charge_QC,
        @zone, @status, @charged_weight, @gross_amount, @total_amount,
        @tax_swacch_bharat, @tax_IGST, @tax_SGST, @tax_service, @tax_krishi_kalyan, @tax_CGST
      )
    `);
}

module.exports = {
  createOrder,
  addOrderItems,
  saveTATQuery,
  getCustomerOrders,
  getOrderDetails,
  updateOrderStatus,
  saveShippingCharge,
};
