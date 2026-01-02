// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const morgan = require("morgan");
const fs = require("fs");
const logger = require("./config/logger");
const security = require("./middleware/security");
const createRateLimiter = require("./middleware/rateLimiter");

// Import bcrypt for hashing and user model
const bcrypt = require("bcryptjs");
const { findUserByEmail, createUser } = require("./models/admin/userModel");

// Admin routes
const authRoutes = require("./routes/admin/authRoutes");
const teaRoutes = require("./routes/admin/teaRoutes");
const adminOrderRoutes = require("./routes/admin/orderRoutes");
// Add with other admin routes imports
const adminCustomerRoutes = require("./routes/admin/customerRoutes");
const adminDiscountRoutes = require("./routes/admin/discountRoutes");


// Customer routes
const customerAuthRoutes = require("./routes/customer/authRoutes");

// Add this import with other admin routes
const ingredientRoutes = require("./routes/admin/ingredientRoutes");

// Add with other customer routes
const customerCartRoutes = require("./routes/customer/cartRoutes");
const customerOrderRoutes = require("./routes/customer/orderRoutes");
const customerDiscountRoutes = require("./routes/customer/discountRoutes");

// Address routes
const addressRoutes = require("./routes/customer/addressRoutes");

const DiscountModel = require("./models/admin/discountModel");

const app = express();
const port = process.env.PORT || 4000;

// Run every 30 seconds (safe + efficient)
setInterval(async () => {
  try {
    await DiscountModel.autoExpireDiscounts();
  } catch (err) {
    console.error("Auto-expire discounts failed:", err.message);
  }
}, 30 * 1000);

// Ensure uploads and logs directories exist
["uploads", "uploads/images", "uploads/files", "logs"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Logging HTTP requests (morgan -> winston)
app.use(morgan("combined", {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Security middlewares (helmet, xss-clean, cookie-parser, CORS)
security(app);

// Body parsers
app.use(express.json({ limit: "10kb" })); // limit payloads
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Rate limiter (global fallback)
// app.use(createRateLimiter());

// Static uploads route (serve carefully, consider auth in prod)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Admin Routes
app.use("/api/auth", authRoutes);
app.use("/api/tea", teaRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
// Add with other admin route registrations
app.use("/api/admin/customers", adminCustomerRoutes);
// In your main router file (e.g., server.js)
app.use('/api/admin/discounts', adminDiscountRoutes);

// Customer Routes
app.use("/api/customer/auth", customerAuthRoutes);

// Add this route with other admin routes
app.use("/api/ingredients", ingredientRoutes);

// Add with other route registrations
app.use("/api/customer/cart", customerCartRoutes);
app.use("/api/customer/orders", customerOrderRoutes);
app.use("/api/discounts", customerDiscountRoutes);

// Address routes
app.use("/api/customer/address", addressRoutes);

// Generic error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error: %o", err);
  res.status(500).json({ error: "Internal server error" });
});

require("./cron/whatsappNudges");


// Create default admin user if not exists
async function createDefaultAdmin() {
  try {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@12345";
    const adminName = process.env.DEFAULT_ADMIN_NAME || "Super Admin";

    const existingAdmin = await findUserByEmail(adminEmail);
    if (existingAdmin) {
      console.log("✅ Admin user already exists:", adminEmail);
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const newAdmin = await createUser({
      email: adminEmail,
      passwordHash: hashedPassword,
      name: adminName,
      role: "admin"
    });

    console.log("🚀 Default admin user created successfully:");
    console.log(`Email: ${newAdmin.email}`);
    console.log(`Password: ${adminPassword}`);
  } catch (err) {
    console.error("❌ Failed to create default admin:", err.message);
  }
}

(async () => {
  await createDefaultAdmin();  // <-- Auto-create admin on startup

  app.listen(port, "0.0.0.0", () => {
    logger.info(`Server running on port ${port}`);
    console.log(`Server running on port ${port}`);
  });
})();