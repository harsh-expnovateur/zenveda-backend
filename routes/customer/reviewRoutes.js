const express = require("express");
const router = express.Router();
const { submitReview, getOrderForReview, getTeaRatings, getPublicReviews } = require("../../controllers/customer/reviewController");

router.post("/", submitReview);
router.get("/tea/ratings", getTeaRatings);
router.get("/public", getPublicReviews);
router.get("/:orderId", getOrderForReview);


module.exports = router;
