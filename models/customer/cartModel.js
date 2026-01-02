// models/customer/cartModel.js
const { getPool, mssql } = require("../../config/db");

/**
 * Add item to cart or update quantity if exists
 */
async function addToCart({ customerId, teaId, packageId, quantity }) {
  const pool = await getPool();

  // Check if item already exists in cart
  const existing = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .input("tea_id", mssql.Int, teaId)
    .input("package_id", mssql.Int, packageId)
    .query(`
      SELECT cart_id, quantity FROM customer_cart
      WHERE customer_id = @customer_id AND tea_id = @tea_id AND package_id = @package_id
    `);

  if (existing.recordset.length > 0) {
    // Update quantity
    const newQuantity = existing.recordset[0].quantity + quantity;
    await pool
      .request()
      .input("cart_id", mssql.Int, existing.recordset[0].cart_id)
      .input("quantity", mssql.Int, newQuantity)
      .query(`
        UPDATE customer_cart 
        SET quantity = @quantity, updated_at = SYSUTCDATETIME()
        WHERE cart_id = @cart_id
      `);
    return { cart_id: existing.recordset[0].cart_id, updated: true };
  } else {
    // Insert new item
    const result = await pool
      .request()
      .input("customer_id", mssql.Int, customerId)
      .input("tea_id", mssql.Int, teaId)
      .input("package_id", mssql.Int, packageId)
      .input("quantity", mssql.Int, quantity)
      .query(`
        INSERT INTO customer_cart (customer_id, tea_id, package_id, quantity)
        OUTPUT INSERTED.cart_id
        VALUES (@customer_id, @tea_id, @package_id, @quantity)
      `);
    return { cart_id: result.recordset[0].cart_id, updated: false };
  }
}

/**
 * Get cart items for customer
 */
async function getCartItems(customerId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      SELECT 
        cc.cart_id,
        cc.tea_id,
        cc.package_id,
        cc.quantity,
        t.name AS tea_name,
        
        tp.package_name,
        tp.selling_price,
        ti.image_url
      FROM customer_cart cc
      INNER JOIN teas t ON cc.tea_id = t.id
      INNER JOIN tea_packages tp ON cc.package_id = tp.id
      LEFT JOIN tea_images ti ON t.id = ti.tea_id AND ti.is_main_image = 1
      WHERE cc.customer_id = @customer_id
      ORDER BY cc.added_at DESC
    `);
  return result.recordset;
}

/**
 * Get cart count for customer
 */
async function getCartCount(customerId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      SELECT COUNT(*) AS count FROM customer_cart
      WHERE customer_id = @customer_id
    `);
  return result.recordset[0].count;
}

/**
 * Update cart item quantity
 */
async function updateCartQuantity(cartId, customerId, quantity) {
  const pool = await getPool();
  await pool
    .request()
    .input("cart_id", mssql.Int, cartId)
    .input("customer_id", mssql.Int, customerId)
    .input("quantity", mssql.Int, quantity)
    .query(`
      UPDATE customer_cart 
      SET quantity = @quantity, updated_at = SYSUTCDATETIME()
      WHERE cart_id = @cart_id AND customer_id = @customer_id
    `);
}

/**
 * Remove item from cart
 */
async function removeFromCart(cartId, customerId) {
  const pool = await getPool();
  await pool
    .request()
    .input("cart_id", mssql.Int, cartId)
    .input("customer_id", mssql.Int, customerId)
    .query(`
      DELETE FROM customer_cart 
      WHERE cart_id = @cart_id AND customer_id = @customer_id
    `);
}

/**
 * Clear customer cart
 */
async function clearCart(customerId) {
  const pool = await getPool();
  await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      DELETE FROM customer_cart WHERE customer_id = @customer_id
    `);
}

module.exports = {
  addToCart,
  getCartItems,
  getCartCount,
  updateCartQuantity,
  removeFromCart,
  clearCart,
};
