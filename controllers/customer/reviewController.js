const { getPool, mssql } = require("../../config/db");
const { createReview } = require("../../models/customer/reviewModel");

const getTeaRatings = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        tea_id,
        AVG(CAST(rating AS FLOAT)) AS average_rating,
        COUNT(review_id) AS total_reviews
      FROM customer_reviews
      GROUP BY tea_id
    `);

    res.json({
      success: true,
      ratings: result.recordset,
    });

  } catch (err) {
    console.error("Fetch tea ratings error:", err);
    res.status(500).json({ error: "Server error" });
  }
};


const submitReview = async (req, res) => {
  try {
    const { order_item_id, rating, review_text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Invalid rating" });
    }

    const pool = await getPool();

    // 🔎 1️⃣ Get order item details
    const result = await pool
      .request()
      .input("order_item_id", mssql.Int, order_item_id).query(`
        SELECT oi.*, o.order_number, o.customer_id, o.status
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.order_item_id = @order_item_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = result.recordset[0];

    // 🚚 2️⃣ Check delivered
    if (item.status !== "Delivered") {
      return res.status(400).json({ message: "Order not delivered yet" });
    }

    // 🚫 3️⃣ CHECK DUPLICATE REVIEW (ADD HERE)
    const existingReview = await pool
      .request()
      .input("order_item_id", mssql.Int, order_item_id).query(`
        SELECT review_id FROM customer_reviews
        WHERE order_item_id = @order_item_id
      `);

    if (existingReview.recordset.length > 0) {
      return res.status(400).json({
        message: "Review already submitted for this item",
      });
    }

    // 👤 4️⃣ Get customer name
    const customerResult = await pool
      .request()
      .input("customer_id", mssql.Int, item.customer_id).query(`
        SELECT name FROM CustomerRegistration 
        WHERE customer_id = @customer_id
      `);

    const reviewData = {
      order_id: item.order_id,
      order_item_id: item.order_item_id,
      order_number: item.order_number,
      customer_id: item.customer_id,
      customer_name: customerResult.recordset[0].name,
      tea_id: item.tea_id,
      tea_name: item.tea_name,
      package_id: item.package_id,
      package_name: item.package_name,
      quantity: item.quantity,
      price_per_unit: item.price_per_unit,
      rating,
      review_text,
    };

    await createReview(reviewData);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Review submission error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getOrderForReview = async (req, res) => {
  try {
    const { orderId } = req.params; // this is actually order_number

    console.log("Fetching order for review:", orderId);

    const pool = await getPool();

    // First, check if order exists
    const orderCheck = await pool
      .request()
      .input("order_number", mssql.NVarChar(50), orderId)
      .query(`
        SELECT order_id, order_number, customer_name, status
        FROM orders
        WHERE order_number = @order_number
      `);

    console.log("Order check result:", orderCheck.recordset);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({
        message: "Order not found",
        orderId: orderId,
      });
    }

    // Now get order items
    const result = await pool
      .request()
      .input("order_number", mssql.NVarChar(50), orderId)
      .query(`
        SELECT 
          o.order_id,
          o.order_number,
          o.customer_name,
          o.status,
          oi.order_item_id,
          oi.tea_id,
          oi.tea_name,
          oi.package_id,
          oi.package_name,
          oi.quantity,
          oi.price_per_unit
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.order_number = @order_number
      `);

    console.log("Order items result:", result.recordset);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: "No items found for this order",
        orderId: orderId,
      });
    }

    // 🔥 NEW: CHECK IF REVIEW ALREADY EXISTS FOR THIS ORDER
    const reviewCheck = await pool
      .request()
      .input("order_number", mssql.NVarChar(50), orderId)
      .query(`
        SELECT review_id 
        FROM customer_reviews
        WHERE order_number = @order_number
      `);

    if (reviewCheck.recordset.length > 0) {
      return res.json({
        alreadyReviewed: true
      });
    }

    // 🔥 Normal response (no review yet)
    res.json({
      alreadyReviewed: false,
      order: result.recordset
    });

  } catch (err) {
    console.error("Review fetch error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

const getPublicReviews = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT TOP 20
        review_id,
        customer_name,
        review_text,
        rating,
        tea_name
      FROM customer_reviews
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      reviews: result.recordset,
    });
  } catch (err) {
    console.error("Fetch public reviews error:", err);
    res.status(500).json({ error: "Server error" });
  }
};



module.exports = {
  submitReview,
  getOrderForReview,
  getTeaRatings,
  getPublicReviews
};
