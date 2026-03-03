const { getPool, mssql } = require("../../config/db");

const getAllReviews = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        r.review_id,
        r.order_number,
        r.customer_name,
        r.tea_name,
        r.package_name,
        r.rating,
        r.review_text,
        r.is_active,
        r.created_at
      FROM customer_reviews r
      ORDER BY r.created_at DESC
    `);

    res.json({ success: true, reviews: result.recordset });
  } catch (err) {
    console.error("Fetch reviews error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteReview = async (req, res) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    await pool
      .request()
      .input("id", mssql.Int, id)
      .query(`DELETE FROM customer_reviews WHERE review_id = @id`);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete review error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const toggleReviewStatus = async (req, res) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    await pool.request()
      .input("id", mssql.Int, id)
      .query(`
        UPDATE customer_reviews
        SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
        WHERE review_id = @id
      `);

    res.json({ success: true });

  } catch (err) {
    console.error("Toggle review error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const reviewStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/reviews";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: reviewStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const addReview = async (req, res) => {
  const teaId = parseInt(req.body.tea_id);

  if (!teaId || isNaN(teaId)) {
    return res.status(400).json({ error: "Valid tea_id is required" });
  }

  try {
    const pool = await getPool();

    const { customer_name, tea_name, package_name, rating, review_text } =
      req.body;

    let mediaType = null;
    let mediaUrl = null;

    if (req.file) {
      mediaUrl = `/uploads/reviews/${req.file.filename}`;
      mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";
    }

    await pool
      .request()
      .input("order_id", mssql.Int, null)
      .input("order_item_id", mssql.Int, null)
      .input("order_number", mssql.NVarChar, null)
      .input("customer_id", mssql.Int, 0)
      .input("customer_name", mssql.NVarChar, customer_name)
      .input("tea_id", mssql.Int, teaId)
      .input("tea_name", mssql.NVarChar, tea_name)
      .input("package_id", mssql.Int, null)
      .input("package_name", mssql.NVarChar, package_name || "")
      .input("quantity", mssql.Int, null)
      .input("price_per_unit", mssql.Decimal(10, 2), null)
      .input("rating", mssql.Int, rating)
      .input("review_text", mssql.NVarChar, review_text)
      .input("media_type", mssql.NVarChar, mediaType)
      .input("media_url", mssql.NVarChar, mediaUrl).query(`
        INSERT INTO customer_reviews (
          order_id,
          order_item_id,
          order_number,
          customer_id,
          customer_name,
          tea_id,
          tea_name,
          package_id,
          package_name,
          quantity,
          price_per_unit,
          rating,
          review_text,
          media_type,
          media_url
        )
        VALUES (
          @order_id,
          @order_item_id,
          @order_number,
          @customer_id,
          @customer_name,
          @tea_id,
          @tea_name,
          @package_id,
          @package_name,
          @quantity,
          @price_per_unit,
          @rating,
          @review_text,
          @media_type,
          @media_url
        )
      `);

    res.json({ success: true });
  } catch (err) {
    console.error("Add review error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getAllReviews,
  deleteReview,
  addReview,
  toggleReviewStatus,
  upload,
};
