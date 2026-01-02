// controllers/admin/discountController.js

const DiscountModel = require("../../models/admin/discountModel");
const fs = require("fs");
const path = require("path");

class DiscountController {
  // Create discount
  static async createDiscount(req, res) {
    try {
      const discountData = req.body;

      // Validate required fields
      if (
        !discountData.name ||
        !discountData.type ||
        !discountData.start_date ||
        !discountData.end_date
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, type, start date, and end date are required",
        });
      }

      // Check if code already exists for coupon types
      if (discountData.code) {
        const existing = await DiscountModel.getByCode(discountData.code);
        if (existing) {
          return res.status(400).json({
            success: false,
            message: "Discount code already exists",
          });
        }
      }

      const discount = await DiscountModel.create(discountData);

      res.status(201).json({
        success: true,
        message: "Discount created successfully",
        discount,
      });
    } catch (error) {
      console.error("Create discount error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create discount",
        error: error.message,
      });
    }
  }

  // Get all discounts
  static async getAllDiscounts(req, res) {
    try {
      const { status } = req.query;
      const discounts = await DiscountModel.getAll(status);

      res.json({
        success: true,
        discounts,
      });
    } catch (error) {
      console.error("Get discounts error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch discounts",
        error: error.message,
      });
    }
  }

  // Get discount by ID
  static async getDiscountById(req, res) {
    try {
      const { id } = req.params;
      const discount = await DiscountModel.getById(id);

      if (!discount) {
        return res.status(404).json({
          success: false,
          message: "Discount not found",
        });
      }

      res.json({
        success: true,
        discount,
      });
    } catch (error) {
      console.error("Get discount error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch discount",
        error: error.message,
      });
    }
  }

  // Update discount
  static async updateDiscount(req, res) {
    try {
      const { id } = req.params;
      const discountData = req.body;

      // Check if discount exists
      const existing = await DiscountModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Discount not found",
        });
      }

      // Check if code already exists (if updating code)
      if (discountData.code && discountData.code !== existing.code) {
        const codeExists = await DiscountModel.getByCode(discountData.code);
        if (codeExists) {
          return res.status(400).json({
            success: false,
            message: "Discount code already exists",
          });
        }
      }

      // Delete old images if new ones are uploaded
      if (discountData.banner_image && existing.banner_image) {
        const oldImagePath = path.join(__dirname, "..", "..", existing.banner_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      if (discountData.thumbnail_image && existing.thumbnail_image) {
        const oldImagePath = path.join(__dirname, "..", "..", existing.thumbnail_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      const discount = await DiscountModel.update(id, discountData);

      res.json({
        success: true,
        message: "Discount updated successfully",
        discount,
      });
    } catch (error) {
      console.error("Update discount error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update discount",
        error: error.message,
      });
    }
  }

  // Toggle status
  static async toggleStatus(req, res) {
    try {
      const { id } = req.params;

      const discount = await DiscountModel.getById(id);
      if (!discount) {
        return res.status(404).json({
          success: false,
          message: "Discount not found",
        });
      }

      const updated = await DiscountModel.toggleStatus(id);

      res.json({
        success: true,
        message: "Discount status updated successfully",
        discount: updated,
      });
    } catch (error) {
      console.error("Toggle status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update discount status",
        error: error.message,
      });
    }
  }

  // Delete discount
  static async deleteDiscount(req, res) {
    try {
      const { id } = req.params;

      const discount = await DiscountModel.getById(id);
      if (!discount) {
        return res.status(404).json({
          success: false,
          message: "Discount not found",
        });
      }

      // Delete images if they exist
      if (discount.banner_image) {
        const imagePath = path.join(__dirname, "..", "..", discount.banner_image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      if (discount.thumbnail_image) {
        const imagePath = path.join(__dirname, "..", "..", discount.thumbnail_image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      await DiscountModel.delete(id);

      res.json({
        success: true,
        message: "Discount deleted successfully",
      });
    } catch (error) {
      console.error("Delete discount error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete discount",
        error: error.message,
      });
    }
  }

  // Validate discount code (for customer use)
  static async validateDiscount(req, res) {
    try {
      const { code, cartValue, teaIds } = req.body;

      if (!code || !cartValue) {
        return res.status(400).json({
          success: false,
          message: "Code and cart value are required",
        });
      }

      const validation = await DiscountModel.validateDiscount(
        code,
        cartValue,
        teaIds || []
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
        });
      }

      res.json({
        success: true,
        message: "Discount code is valid",
        discount: validation.discount,
      });
    } catch (error) {
      console.error("Validate discount error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate discount",
        error: error.message,
      });
    }
  }
}

module.exports = DiscountController;