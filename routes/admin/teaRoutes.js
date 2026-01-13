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
const { authenticate } = require("../../middleware/authenticate");
const checkPermission = require("../../middleware/checkPermission");

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

router.use(authenticate);

// GET global icons (tea_id IS NULL)
router.get("/global-icons", checkPermission("tea-management"), getGlobalIcons);

// PUT update global icons (admin only)
router.put("/global-icons", upload.fields([{ name: "icons" }]), checkPermission("tea-management"), updateGlobalIcons);

// GET all teas
router.get("/", checkPermission("tea-management"), getAllTeas);

// GET single tea by slug
router.get("/slug/:slug", checkPermission("tea-management"), getTeaById);

// GET single tea by id
router.get("/:id", checkPermission("tea-management"), getTeaById);

// POST create new tea
router.post(
  "/",
  upload.fields([
    { name: "teaImages" },
    { name: "brewingIcons" },
  ]),
  checkPermission("tea-management"), createTea
);

// PUT update tea
router.put(
  "/:id",
  upload.fields([
    { name: "teaImages" },
    { name: "brewingIcons" },
  ]),
  checkPermission("tea-management"), updateTea
);

// DELETE tea
router.delete("/:id", checkPermission("tea-management"), deleteTea);

// PATCH toggle tea status
router.patch("/:id/toggle", checkPermission("tea-management"), toggleTeaStatus);

module.exports = router;