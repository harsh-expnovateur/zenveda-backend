const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const router = express.Router();

// 🔒 SECURITY: Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// 🔒 SECURITY: File type validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_FILE_TYPES];
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error(
        "Invalid file type. Only images (JPEG, PNG, GIF, WebP) and documents (PDF, DOC, DOCX, XLS, XLSX) are allowed."
      ),
      false
    );
  }

  // 🔒 SECURITY: Additional extension check
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx"
  ];

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Invalid file extension"), false);
  }

  cb(null, true);
};

// 🧩 Storage setup with enhanced security
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest = "uploads/files";

    // Determine destination based on file type
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      // Special handling for discount images
      if (req.path === "/discount") {
        dest = "uploads/images/discount";
      } else {
        dest = "uploads/images";
      }
    }

    // 🔒 SECURITY: Ensure directory exists
    const fullPath = path.join(__dirname, "..", dest);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    // 🔒 SECURITY: Generate cryptographically secure random filename
    const randomName = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedExt = ext.replace(/[^a-z0-9.]/gi, "");
    
    cb(null, `${Date.now()}-${randomName}${sanitizedExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
    files: 1, // Only 1 file per request
  },
  fileFilter,
});

// 🔒 SECURITY: Error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Only 1 file allowed per upload",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }

  next();
};

// 🧾 POST /api/upload/single - General file upload
router.post("/single", upload.single("file"), handleMulterError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);
  const relativePath = isImage
    ? `uploads/images/${req.file.filename}`
    : `uploads/files/${req.file.filename}`;

  res.json({
    success: true,
    fileName: req.file.filename,
    relativePath,
    fullUrl: `${req.protocol}://${req.get("host")}/${relativePath}`,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  });
});

// 🎨 POST /api/upload/discount - Discount image upload (NEW)
router.post("/discount", upload.single("file"), handleMulterError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  // 🔒 SECURITY: Ensure only images are uploaded for discounts
  if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
    // Delete the uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      message: "Only image files are allowed for discount uploads",
    });
  }

  const relativePath = `uploads/images/discount/${req.file.filename}`;

  res.json({
    success: true,
    fileName: req.file.filename,
    relativePath,
    fullUrl: `${req.protocol}://${req.get("host")}/${relativePath}`,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  });
});

// 🗑️ DELETE /api/upload/:type/:filename - Delete uploaded file (NEW)
router.delete("/:type/:filename", (req, res) => {
  try {
    const { type, filename } = req.params;

    // 🔒 SECURITY: Validate type parameter
    const allowedTypes = ["images", "files", "discount"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type",
      });
    }

    // 🔒 SECURITY: Prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    
    let filePath;
    if (type === "discount") {
      filePath = path.join(__dirname, "..", "uploads", "images", "discount", sanitizedFilename);
    } else {
      filePath = path.join(__dirname, "..", "uploads", type, sanitizedFilename);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
});

module.exports = router;