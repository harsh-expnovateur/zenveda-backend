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
const { authenticate } = require("../../middleware/authenticate");
const checkPermission = require("../../middleware/checkPermission");

const router = express.Router();

const uploadPath = path.join(__dirname, "../../uploads/images");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

router.use(authenticate);

// GET all ingredients
router.get("/", checkPermission("manage-ingredients"), getIngredients);

// GET single ingredient
router.get("/:id", checkPermission("manage-ingredients"), getIngredient);

// POST create ingredient
router.post("/", upload.single("image"), checkPermission("manage-ingredients"), createIngredientHandler);

// PUT update ingredient
router.put("/:id", upload.single("image"), checkPermission("manage-ingredients"), updateIngredientHandler);

// DELETE ingredient
router.delete("/:id", checkPermission("manage-ingredients"), deleteIngredientHandler);

module.exports = router;