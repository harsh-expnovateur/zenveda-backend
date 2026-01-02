const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  getIngredients,
  getIngredient,
  createIngredientHandler,
  updateIngredientHandler,
  deleteIngredientHandler,
} = require("../../controllers/admin/ingredientController");

const router = express.Router();

const uploadPath = path.join(__dirname, "../../uploads/images");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// GET all ingredients
router.get("/", getIngredients);

// GET single ingredient
router.get("/:id", getIngredient);

// POST create ingredient
router.post("/", upload.single("image"), createIngredientHandler);

// PUT update ingredient
router.put("/:id", upload.single("image"), updateIngredientHandler);

// DELETE ingredient
router.delete("/:id", deleteIngredientHandler);

module.exports = router;