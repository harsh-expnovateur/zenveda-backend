const express = require("express");
const router = express.Router();
const { submitReview, getOrderForReview, getTeaRatings, getPublicReviews, getTeaReviews, upload } = require("../../controllers/customer/reviewController");

router.post(
  "/",
  upload.array("media", 10), // Max 10 files
  submitReview
);
router.get("/tea/ratings", getTeaRatings);
router.get("/tea/:teaId", getTeaReviews);
router.get("/public", getPublicReviews);
router.get("/:orderId", getOrderForReview);


module.exports = router;
