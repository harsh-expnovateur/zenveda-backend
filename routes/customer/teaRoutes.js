const express = require("express");
const {
  getAllTeas,
  getTeaById
} = require("../../controllers/admin/teaController");

const router = express.Router();

// Public routes
router.get("/", getAllTeas);
router.get("/slug/:slug", getTeaById);
router.get("/:id", getTeaById);

module.exports = router;
