const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { 
  createTea, 
  getAllTeas, 
  getTeaById, 
  updateTea, 
  deleteTea, 
  toggleTeaStatus,
  getGlobalIcons,
  updateGlobalIcons
} = require("../../controllers/admin/teaController");

const router = express.Router();

const uploadPath = path.join(__dirname, "../../uploads/images");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// GET global icons (tea_id IS NULL)
router.get("/global-icons", getGlobalIcons);

// PUT update global icons (admin only)
router.put("/global-icons", upload.fields([{ name: "icons" }]), updateGlobalIcons);

// GET all teas
router.get("/", getAllTeas);

// GET single tea by slug
router.get("/slug/:slug", getTeaById);

// GET single tea by id
router.get("/:id", getTeaById);

// POST create new tea
router.post(
  "/",
  upload.fields([
    { name: "teaImages" },
    { name: "brewingIcons" },
  ]),
  createTea
);

// PUT update tea
router.put(
  "/:id",
  upload.fields([
    { name: "teaImages" },
    { name: "brewingIcons" },
  ]),
  updateTea
);

// DELETE tea
router.delete("/:id", deleteTea);

// PATCH toggle tea status
router.patch("/:id/toggle", toggleTeaStatus);

module.exports = router;