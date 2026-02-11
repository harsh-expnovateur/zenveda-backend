const { getPool, mssql } = require("../../config/db");

// Insert Review
const createReview = async (reviewData) => {
  const pool = await getPool();

  const result = await pool.request()
    .input("order_id", mssql.Int, reviewData.order_id)
    .input("order_item_id", mssql.Int, reviewData.order_item_id)
    .input("order_number", mssql.NVarChar(50), reviewData.order_number)
    .input("customer_id", mssql.Int, reviewData.customer_id)
    .input("customer_name", mssql.NVarChar(100), reviewData.customer_name)
    .input("tea_id", mssql.Int, reviewData.tea_id)
    .input("tea_name", mssql.NVarChar(255), reviewData.tea_name)
    .input("package_id", mssql.Int, reviewData.package_id)
    .input("package_name", mssql.NVarChar(50), reviewData.package_name)
    .input("quantity", mssql.Int, reviewData.quantity)
    .input("price_per_unit", mssql.Decimal(10, 2), reviewData.price_per_unit)
    .input("rating", mssql.Int, reviewData.rating)
    .input("review_text", mssql.NVarChar(mssql.MAX), reviewData.review_text)
    .query(`
      INSERT INTO customer_reviews
      (order_id, order_item_id, order_number, customer_id, customer_name,
       tea_id, tea_name, package_id, package_name,
       quantity, price_per_unit, rating, review_text)
      VALUES
      (@order_id, @order_item_id, @order_number, @customer_id, @customer_name,
       @tea_id, @tea_name, @package_id, @package_name,
       @quantity, @price_per_unit, @rating, @review_text)
    `);

  return result;
};

module.exports = {
  createReview
};
