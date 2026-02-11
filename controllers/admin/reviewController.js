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

    await pool.request()
      .input("id", mssql.Int, id)
      .query(`DELETE FROM customer_reviews WHERE review_id = @id`);

    res.json({ success: true });

  } catch (err) {
    console.error("Delete review error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getAllReviews,
  deleteReview
};
