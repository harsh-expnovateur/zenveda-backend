// controllers/customer/cartController.js
const {
  addToCart,
  getCartItems,
  getCartCount,
  updateCartQuantity,
  removeFromCart,
} = require("../../models/customer/cartModel");
const logger = require("../../config/logger");

/**
 * Add item to cart
 */
const addItemToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { teaId, packageId, quantity = 1 } = req.body;

    if (!teaId || !packageId) {
      return res.status(400).json({
        success: false,
        error: "Tea ID and Package ID are required",
      });
    }

    const result = await addToCart({
      customerId,
      teaId,
      packageId,
      quantity,
    });

    logger.info("Item added to cart", { customerId, teaId, packageId });

    res.json({
      success: true,
      message: result.updated ? "Cart updated successfully" : "Item added to cart",
      cartId: result.cart_id,
    });
  } catch (err) {
    logger.error("Add to cart error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to add item to cart",
    });
  }
};

/**
 * Get cart items
 */
const getCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const items = await getCartItems(customerId);

    // Format items
    const formattedItems = items.map((item) => ({
      id: item.cart_id,
      teaId: item.tea_id,
      packageId: item.package_id,
      name: item.tea_name,
      slug: item.tea_slug,
      package: item.package_name,
      price: parseFloat(item.selling_price),
      quantity: item.quantity,
      image: item.image_url ? `http://localhost:5000/${item.image_url}` : null,
    }));

    const totalAmount = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    res.json({
      success: true,
      cart: formattedItems,
      totalAmount,
      itemCount: formattedItems.length,
    });
  } catch (err) {
    logger.error("Get cart error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to fetch cart",
    });
  }
};

/**
 * Get cart count
 */
const getCartItemCount = async (req, res) => {
  try {
    const customerId = req.user.id;
    const count = await getCartCount(customerId);

    res.json({
      success: true,
      count,
    });
  } catch (err) {
    logger.error("Get cart count error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to get cart count",
    });
  }
};

/**
 * Update cart item quantity
 */
const updateCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { cartId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: "Invalid quantity",
      });
    }

    await updateCartQuantity(parseInt(cartId), customerId, quantity);

    res.json({
      success: true,
      message: "Cart updated successfully",
    });
  } catch (err) {
    logger.error("Update cart error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to update cart",
    });
  }
};

/**
 * Remove item from cart
 */
const removeItem = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { cartId } = req.params;

    await removeFromCart(parseInt(cartId), customerId);

    res.json({
      success: true,
      message: "Item removed from cart",
    });
  } catch (err) {
    logger.error("Remove from cart error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: "Failed to remove item",
    });
  }
};

module.exports = {
  addItemToCart,
  getCart,
  getCartItemCount,
  updateCart,
  removeItem,
};