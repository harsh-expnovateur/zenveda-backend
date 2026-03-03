const express = require("express");
const router = express.Router();

const { getAllReviews, deleteReview, addReview, toggleReviewStatus, upload } = require("../../controllers/admin/reviewController");
const { authenticate } = require("../../middleware/authenticate");   // 👈 FIX
const checkPermission = require("../../middleware/checkPermission");

// All routes require authentication
router.use(authenticate);

router.get("/", checkPermission("reviews"), getAllReviews);
router.delete("/:id", checkPermission("reviews"), deleteReview);
router.post(
  "/",
  checkPermission("reviews"),
  upload.single("media"),
  addReview
);
router.patch(
  "/:id/toggle",
  checkPermission("reviews"),
  toggleReviewStatus
);

module.exports = router;
