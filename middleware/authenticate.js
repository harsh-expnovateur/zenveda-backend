// middleware/authenticate.js
const { verifyAccessToken } = require("../utils/jwt");

/**
 * Middleware to authenticate users via Bearer token
 */
exports.authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if header exists and starts with Bearer
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - Token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token using your JWT utility
    const decoded = verifyAccessToken(token);

    // Attach decoded payload (user info) to request
    req.user = decoded;

    // Continue request
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Middleware to check if authenticated user is admin
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - Authentication required" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }

  next();
};