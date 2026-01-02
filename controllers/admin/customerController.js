// controllers/admin/customerController.js
const { getPool, mssql } = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Get all customers with their order statistics
 */
const getAllCustomers = async (req, res) => {
  try {
    const pool = await getPool();
    
    // Get customers with their order statistics
    const result = await pool.query(`
      SELECT 
        c.customer_id,
        c.name,
        c.phone_number,
        c.email,
        c.created_at,
        COUNT(o.order_id) as order_count,
        ISNULL(SUM(o.total_amount), 0) as total_spend,
        CASE 
          WHEN COUNT(o.order_id) >= 30 THEN 'VIP'
          WHEN COUNT(o.order_id) >= 10 THEN 'Active'
          WHEN COUNT(o.order_id) > 0 THEN 'Active'
          ELSE 'Inactive'
        END as status
      FROM CustomerRegistration c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
      GROUP BY c.customer_id, c.name, c.phone_number, c.email, c.created_at
      ORDER BY c.created_at
    `);

    res.json({
      success: true,
      customers: result.recordset,
    });
  } catch (err) {
    logger.error("Get all customers error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to fetch customers",
    });
  }
};

/**
 * Get customer statistics
 */
const getCustomerStats = async (req, res) => {
  try {
    const pool = await getPool();
    
    // Total customers
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total FROM CustomerRegistration
    `);
    
    // New customers in last 7 days
    const newCustomersResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM CustomerRegistration 
      WHERE created_at >= DATEADD(day, -7, GETDATE())
    `);
    
    // New customers in previous 7 days (for comparison)
    const previousNewCustomersResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM CustomerRegistration 
      WHERE created_at >= DATEADD(day, -14, GETDATE())
        AND created_at < DATEADD(day, -7, GETDATE())
    `);
    
    const totalCustomers = totalResult.recordset[0].total;
    const newCustomers = newCustomersResult.recordset[0].count;
    const previousNewCustomers = previousNewCustomersResult.recordset[0].count;
    
    // Calculate percentage change
    let percentageChange = 0;
    if (previousNewCustomers > 0) {
      percentageChange = ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100;
    } else if (newCustomers > 0) {
      percentageChange = 100;
    }

    res.json({
      success: true,
      stats: {
        totalCustomers,
        newCustomers,
        previousNewCustomers,
        percentageChange: percentageChange.toFixed(1),
      },
    });
  } catch (err) {
    logger.error("Get customer stats error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to fetch customer statistics",
    });
  }
};

/**
 * Get monthly customer registration data for chart
 */
const getMonthlyCustomerData = async (req, res) => {
  try {
    const pool = await getPool();
    
    // Get customer registrations grouped by month for the last 12 months
    const result = await pool.query(`
      SELECT 
        FORMAT(created_at, 'MMM') as month,
        MONTH(created_at) as month_num,
        YEAR(created_at) as year,
        COUNT(*) as count
      FROM CustomerRegistration
      WHERE created_at >= DATEADD(month, -12, GETDATE())
      GROUP BY FORMAT(created_at, 'MMM'), MONTH(created_at), YEAR(created_at)
      ORDER BY YEAR(created_at), MONTH(created_at)
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    logger.error("Get monthly customer data error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly customer data",
    });
  }
};

/**
 * Delete a customer
 */
const deleteCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const pool = await getPool();
    
    // Check if customer exists
    const customerCheck = await pool
      .request()
      .input("customer_id", mssql.Int, customerId)
      .query(`
        SELECT customer_id FROM CustomerRegistration WHERE customer_id = @customer_id
      `);

    if (customerCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Delete customer (cascade will handle orders)
    await pool
      .request()
      .input("customer_id", mssql.Int, customerId)
      .query(`
        DELETE FROM CustomerRegistration WHERE customer_id = @customer_id
      `);

    logger.info("Customer deleted", {
      customerId,
      adminId: req.user.id,
    });

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (err) {
    logger.error("Delete customer error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to delete customer",
    });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerStats,
  getMonthlyCustomerData,
  deleteCustomer,
};