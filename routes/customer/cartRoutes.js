// routes/customer/cartRoutes.js
const express = require("express");
const { authenticate } = require("../../middleware/authenticate");
const {
  addItemToCart,
  getCart,
  getCartItemCount,
  updateCart,
  removeItem,
} = require("../../controllers/customer/cartController");

const router = express.Router();

// All cart routes require authentication
router.use(authenticate);

router.post("/", addItemToCart);
router.get("/", getCart);
router.get("/count", getCartItemCount);
router.put("/:cartId", updateCart);
router.delete("/:cartId", removeItem);

module.exports = router;