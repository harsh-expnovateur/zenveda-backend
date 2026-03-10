const { getPool, mssql } = require("../../config/db");

// Insert Review + Media
const createReview = async (reviewData, mediaFiles = []) => {
  const pool = await getPool();
  const transaction = new mssql.Transaction(pool);

  try {
    await transaction.begin();

    const request = new mssql.Request(transaction);

    // 1️⃣ Insert review
    const reviewResult = await request
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
        OUTPUT INSERTED.review_id
        VALUES
        (@order_id, @order_item_id, @order_number, @customer_id, @customer_name,
         @tea_id, @tea_name, @package_id, @package_name,
         @quantity, @price_per_unit, @rating, @review_text)
      `);

    const reviewId = reviewResult.recordset[0].review_id;

    // 2️⃣ Insert media files
    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        const mediaRequest = new mssql.Request(transaction);

        await mediaRequest
          .input("review_id", mssql.Int, reviewId)
          .input(
            "media_type",
            mssql.NVarChar(20),
            file.mimetype.startsWith("video") ? "video" : "image"
          )
          .input(
            "media_url",
            mssql.NVarChar(500),
            `/uploads/reviews/${file.filename}`
          )
          .query(`
            INSERT INTO review_media
            (review_id, media_type, media_url)
            VALUES (@review_id, @media_type, @media_url)
          `);
      }
    }

    await transaction.commit();

    return { success: true, reviewId };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  createReview,
};