// controllers/customer/authController.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../../utils/jwt");
const {
  createCustomer,
  findCustomerByEmail,
  findCustomerByPhone,
  findCustomerById,
  storeCustomerRefreshToken,
  findCustomerRefreshToken,
  deleteCustomerRefreshTokenById,
} = require("../../models/customer/customerModel");
const logger = require("../../config/logger");

const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || "12");
const refreshTokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * @desc Register new customer
 * @route POST /api/customer/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, phone, email, dob, password, confirmPassword } = req.body;

    // Validation
    if (!name || !phone || !email || !dob || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    // Check password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Validate phone number (Indian format)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid phone number. Please enter a valid 10-digit Indian mobile number",
      });
    }

    // Check if email already exists
    const existingEmail = await findCustomerByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: "Email already registered",
      });
    }

    // Check if phone already exists
    const existingPhone = await findCustomerByPhone(phone);
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        error: "Phone number already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create customer
    const newCustomer = await createCustomer({
      name,
      phoneNumber: phone,
      email,
      passwordHash,
      dob,
    });

    logger.info("New customer registered", {
      customerId: newCustomer.customer_id,
      email: newCustomer.email,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful! Welcome to Zenveda.",
      customer: {
        id: newCustomer.customer_id,
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone_number,
      },
    });
  } catch (err) {
    logger.error("Customer registration error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Registration failed. Please try again later.",
    });
  }
};

/**
 * @desc Login customer (Email or Phone)
 * @route POST /api/customer/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Validation
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        error: "Email or phone and password are required",
      });
    }

    // Find customer by email or phone
    let customer;
    if (email) {
      customer = await findCustomerByEmail(email);
    } else if (phone) {
      customer = await findCustomerByPhone(phone);
    }

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: "Invalid email/phone or password",
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, customer.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        error: "Invalid email/phone or password",
      });
    }

    // Create JWT payload
    const payload = {
      id: customer.customer_id,
      role: "customer",
      email: customer.email,
    };

    // Generate tokens
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ id: customer.customer_id });

    // Store hashed refresh token
    const decodedRefresh = verifyRefreshToken(refreshToken);
    const expiresAt = new Date(decodedRefresh.exp * 1000);
    const tokenHash = refreshTokenHash(refreshToken);

    await storeCustomerRefreshToken({
      customerId: customer.customer_id,
      tokenHash,
      expiresAt,
    });

    // Set secure httpOnly cookie
    res.cookie("customerRefreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Strict",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    logger.info("Customer logged in", {
      customerId: customer.customer_id,
      email: customer.email,
      phone: customer.phone_number,
    });

    return res.json({
      success: true,
      message: "Login successful!",
      accessToken,
      customer: {
        id: customer.customer_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone_number,
      },
    });
  } catch (err) {
    logger.error("Customer login error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Login failed. Please try again later.",
    });
  }
};

/**
 * @desc Refresh access token
 * @route POST /api/customer/auth/refresh
 */
const refresh = async (req, res) => {
  try {
    const token = req.cookies.customerRefreshToken || req.body.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Missing refresh token",
      });
    }

    // Verify token signature
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Invalid refresh token",
      });
    }

    const tokenHash = refreshTokenHash(token);
    const stored = await findCustomerRefreshToken(tokenHash);
    if (!stored) {
      return res.status(401).json({
        success: false,
        error: "Refresh token not recognized",
      });
    }

    // Check expiry
    if (new Date(stored.expires_at) < new Date()) {
      await deleteCustomerRefreshTokenById(stored.id).catch(() => {});
      return res.status(401).json({
        success: false,
        error: "Refresh token expired. Please login again.",
      });
    }

    const customer = await findCustomerById(stored.customer_id);
    if (!customer) {
      return res.status(401).json({
        success: false,
        error: "Customer not found",
      });
    }

    const payload = {
      id: customer.customer_id,
      role: "customer",
      email: customer.email,
    };
    const newAccessToken = signAccessToken(payload);

    // Rotate refresh tokens (recommended for security)
    await deleteCustomerRefreshTokenById(stored.id);

    const newRefreshToken = signRefreshToken({ id: customer.customer_id });
    const decodedNewRefresh = verifyRefreshToken(newRefreshToken);
    const expiresAt = new Date(decodedNewRefresh.exp * 1000);
    await storeCustomerRefreshToken({
      customerId: customer.customer_id,
      tokenHash: refreshTokenHash(newRefreshToken),
      expiresAt,
    });

    res.cookie("customerRefreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Strict",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    logger.error("Customer refresh token error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Token refresh failed",
    });
  }
};

/**
 * @desc Logout customer
 * @route POST /api/customer/auth/logout
 */
const logout = async (req, res) => {
  try {
    const token = req.cookies.customerRefreshToken || req.body.refreshToken;
    if (token) {
      const tokenHash = refreshTokenHash(token);
      const stored = await findCustomerRefreshToken(tokenHash);
      if (stored) {
        await deleteCustomerRefreshTokenById(stored.id);
      }
    }
    res.clearCookie("customerRefreshToken");
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    logger.error("Customer logout error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Logout failed",
    });
  }
};

/**
 * @desc Get current customer profile
 * @route GET /api/customer/auth/me
 */
const me = async (req, res) => {
  if (!req.user || req.user.role !== "customer") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  try {
    const customer = await findCustomerById(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.json({
      success: true,
      customer: {
        id: customer.customer_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone_number,
        dob: customer.dob,
        createdAt: customer.created_at,
      },
    });
  } catch (err) {
    logger.error("Customer profile fetch error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
