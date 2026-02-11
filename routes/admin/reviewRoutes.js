const express = require("express");
const router = express.Router();

const { getAllReviews, deleteReview } = require("../../controllers/admin/reviewController");
const { authenticate } = require("../../middleware/authenticate");   // 👈 FIX
const checkPermission = require("../../middleware/checkPermission");

// All routes require authentication
router.use(authenticate);

router.get("/", checkPermission("reviews"), getAllReviews);
router.delete("/:id", checkPermission("reviews"), deleteReview);

module.exports = router;
