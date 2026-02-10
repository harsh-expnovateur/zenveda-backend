// models/admin/discountModel.js

const { getPool, mssql } = require("../../config/db");
const logger = require("../../config/logger");

class DiscountModel {
  // Create new discount with tea links
  static async create(discountData) {
    try {
      const pool = await getPool();

      const result = await pool
        .request()
        .input("name", mssql.NVarChar, discountData.name)
        .input("type", mssql.NVarChar, discountData.type)
        .input("code", mssql.NVarChar, discountData.code || null)
        .input(
          "discount_percentage",
          mssql.Decimal(5, 2),
          discountData.discount_percentage || null,
        )
        .input(
          "flat_discount_amount",
          mssql.Decimal(10, 2),
          discountData.flat_discount_amount || null,
        )
        .input("buy_quantity", mssql.Int, discountData.buy_quantity || null)
        .input("get_quantity", mssql.Int, discountData.get_quantity || null)
        .input(
          "min_cart_value",
          mssql.Decimal(10, 2),
          discountData.min_cart_value || null,
        )
        .input(
          "free_product",
          mssql.NVarChar,
          discountData.free_product || null,
        )

        .input(
          "free_product_quantity",
          mssql.Int,
          discountData.free_product_quantity || null,
        )

        .input(
          "banner_image",
          mssql.NVarChar,
          discountData.banner_image || null,
        )
        .input(
          "thumbnail_image",
          mssql.NVarChar,
          discountData.thumbnail_image || null,
        )
        .input(
          "start_date",
          mssql.DateTime2,
          discountData.start_date ? new Date(discountData.start_date) : null,
        )
        .input(
          "end_date",
          mssql.DateTime2,
          discountData.end_date ? new Date(discountData.end_date) : null,
        )
        .input("status", mssql.NVarChar, discountData.status || "active")
        .query(`
          INSERT INTO discounts (
           name, type, code, discount_percentage, flat_discount_amount,
  buy_quantity, get_quantity, min_cart_value, free_product,
  free_product_quantity,
  banner_image, thumbnail_image, start_date, end_date, status
          )
          OUTPUT INSERTED.*
          VALUES (
             @name, @type, @code, @discount_percentage, @flat_discount_amount,
  @buy_quantity, @get_quantity, @min_cart_value, @free_product,
  @free_product_quantity,
  @banner_image, @thumbnail_image, @start_date, @end_date, @status
          )
        `);

      const discount = result.recordset[0];

      // Link teas if tea_ids provided
      if (discountData.tea_ids && discountData.tea_ids.length > 0) {
        await this.linkTeas(discount.id, discountData.tea_ids);
      }

      return discount;
    } catch (error) {
      logger.error("Create discount failed", error);
      throw error;
    }
  }

  // Link teas to discount
  static async linkTeas(discountId, teaIds) {
    const pool = await getPool();

    for (const teaId of teaIds) {
      await pool
        .request()
        .input("discount_id", mssql.Int, discountId)
        .input("tea_id", mssql.Int, teaId).query(`
          INSERT INTO discount_teas (discount_id, tea_id)
          VALUES (@discount_id, @tea_id)
        `);
    }
  }

  // Get linked teas for a discount
  static async getLinkedTeas(discountId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("discount_id", mssql.Int, discountId).query(`
        SELECT t.id, t.name, t.tag, t.is_active
        FROM teas t
        INNER JOIN discount_teas dt ON t.id = dt.tea_id
        WHERE dt.discount_id = @discount_id
        ORDER BY t.name
      `);

    return result.recordset;
  }

  // Get all discounts with linked teas
  static async getAll(status = null) {
    try {
      const pool = await getPool();

      let query = "SELECT * FROM discounts";
      if (status) query += " WHERE status = @status";
      query += " ORDER BY created_at DESC";

      const request = pool.request();
      if (status) request.input("status", mssql.NVarChar, status);

      const result = await request.query(query);
      const discounts = result.recordset;

      // Get linked teas for each discount
      for (let discount of discounts) {
        discount.linked_teas = await this.getLinkedTeas(discount.id);
      }

      return discounts;
    } catch (error) {
      logger.error("Get discounts failed", error);
      throw error;
    }
  }

  // Get discount by ID with linked teas
  static async getById(id) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", mssql.Int, id)
      .query("SELECT * FROM discounts WHERE id = @id");

    if (result.recordset.length === 0) return null;

    const discount = result.recordset[0];
    discount.linked_teas = await this.getLinkedTeas(id);

    return discount;
  }

  // Get discount by code
  static async getByCode(code) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("code", mssql.NVarChar, code)
      .query(
        "SELECT * FROM discounts WHERE code = @code AND status = 'active'",
      );

    return result.recordset[0];
  }

  // Update discount with tea links
  static async update(id, discountData) {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", mssql.Int, id)
      .input("name", mssql.NVarChar, discountData.name)
      .input("type", mssql.NVarChar, discountData.type)
      .input("code", mssql.NVarChar, discountData.code || null)
      .input(
        "discount_percentage",
        mssql.Decimal(5, 2),
        discountData.discount_percentage || null,
      )
      .input(
        "flat_discount_amount",
        mssql.Decimal(10, 2),
        discountData.flat_discount_amount || null,
      )
      .input("buy_quantity", mssql.Int, discountData.buy_quantity || null)
      .input("get_quantity", mssql.Int, discountData.get_quantity || null)
      .input(
        "min_cart_value",
        mssql.Decimal(10, 2),
        discountData.min_cart_value || null,
      )
      .input("free_product", mssql.NVarChar, discountData.free_product || null)
      .input(
        "free_product_quantity",
        mssql.Int,
        discountData.free_product_quantity || null,
      )
      .input("banner_image", mssql.NVarChar, discountData.banner_image || null)
      .input(
        "thumbnail_image",
        mssql.NVarChar,
        discountData.thumbnail_image || null,
      )
      .input(
        "start_date",
        mssql.DateTime2,
        discountData.start_date ? new Date(discountData.start_date) : null,
      )
      .input(
        "end_date",
        mssql.DateTime2,
        discountData.end_date ? new Date(discountData.end_date) : null,
      )
      .input("status", mssql.NVarChar, discountData.status).query(`
        UPDATE discounts
        SET 
          name = @name,
          type = @type,
          code = @code,
          discount_percentage = @discount_percentage,
          flat_discount_amount = @flat_discount_amount,
          buy_quantity = @buy_quantity,
          get_quantity = @get_quantity,
          min_cart_value = @min_cart_value,
          free_product = @free_product,
          free_product_quantity = @free_product_quantity,
          banner_image = @banner_image,
          thumbnail_image = @thumbnail_image,
          start_date = @start_date,
          end_date = @end_date,
          status = @status,
          updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    // Update tea links if provided
    if (discountData.tea_ids !== undefined) {
      // Delete existing links
      await pool
        .request()
        .input("discount_id", mssql.Int, id)
        .query("DELETE FROM discount_teas WHERE discount_id = @discount_id");

      // Add new links
      if (discountData.tea_ids && discountData.tea_ids.length > 0) {
        await this.linkTeas(id, discountData.tea_ids);
      }
    }

    return result.recordset[0];
  }

  // Toggle status
  static async toggleStatus(id) {
    const pool = await getPool();

    const result = await pool.request().input("id", mssql.Int, id).query(`
        UPDATE discounts
        SET 
          status = CASE 
            WHEN status = 'active' THEN 'inactive'
            ELSE 'active'
          END,
          updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    return result.recordset[0];
  }

  // Delete discount (cascade will handle junction table)
  static async delete(id) {
    const pool = await getPool();
    await pool
      .request()
      .input("id", mssql.Int, id)
      .query("DELETE FROM discounts WHERE id = @id");

    return { success: true };
  }

  // Validate discount for cart (with tea validation)
  static async validateDiscount(code, cartValue, teaIds = []) {
    const discount = await this.getByCode(code);

    if (!discount) {
      return { valid: false, message: "Invalid discount code" };
    }

    const now = new Date();
    if (now < discount.start_date || now > discount.end_date) {
      return { valid: false, message: "Discount code has expired" };
    }

    if (discount.min_cart_value && cartValue < discount.min_cart_value) {
      return {
        valid: false,
        message: `Minimum cart value of ₹${discount.min_cart_value} required`,
      };
    }

    // Check if discount is applicable to teas in cart
    const linkedTeas = await this.getLinkedTeas(discount.id);
    if (linkedTeas.length > 0 && teaIds.length > 0) {
      const linkedTeaIds = linkedTeas.map((t) => t.id);
      const hasApplicableTea = teaIds.some((id) => linkedTeaIds.includes(id));

      if (!hasApplicableTea) {
        return {
          valid: false,
          message: "This discount is not applicable to items in your cart",
        };
      }
    }

    // BOGO / Quantity Offer
    if (discount.buy_quantity && discount.get_quantity) {
      return {
        valid: true,
        type: "BOGO",
        buy_quantity: discount.buy_quantity,
        get_quantity: discount.get_quantity,
        tea_ids: linkedTeas.map((t) => t.id),
        discount,
      };
    }

    // Normal discount
    return { valid: true, discount };
  }

  // Auto-expire discounts
  static async autoExpireDiscounts() {
    const pool = await getPool();

    await pool.request().query(`
      UPDATE discounts
      SET 
        status = 'inactive',
        updated_at = GETDATE()
      WHERE 
        status = 'active'
        AND end_date <= GETDATE()
    `);
  }

  // ================= CUSTOMER COUPON VALIDATION =================
  static async validateForCustomer({ code, cartValue, teaIds }) {
    const discounts = await this.getAll("active");
    const now = new Date();

    const discount = discounts.find(
      (d) =>
        d.code?.toUpperCase() === code.toUpperCase() &&
        new Date(d.start_date) <= now &&
        new Date(d.end_date) >= now &&
        (d.type === "Coupon Code" || d.type === "Flat Price Off"),
    );

    if (!discount) {
      return {
        valid: false,
        message: "Invalid or expired promo code",
      };
    }

    // Minimum cart value check
    if (discount.min_cart_value && cartValue < discount.min_cart_value) {
      return {
        valid: false,
        message: `Minimum cart value ₹${discount.min_cart_value} required`,
      };
    }

    // Tea specific coupon check
    if (discount.linked_teas && discount.linked_teas.length > 0) {
      const linkedTeaIds = discount.linked_teas.map((t) => t.id);
      const applicable = teaIds.some((id) => linkedTeaIds.includes(id));

      if (!applicable) {
        return {
          valid: false,
          message: "Promo code not applicable to selected items",
        };
      }
    }

    return {
      valid: true,
      discount,
    };
  }
}

module.exports = DiscountModel;
