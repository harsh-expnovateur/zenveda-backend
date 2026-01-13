// middleware/auth.js
const { verifyAccessToken } = require("../utils/jwt");
const logger = require("../config/logger");

/**
 * Middleware to authenticate users via Bearer token
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if header exists and starts with Bearer
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token using your JWT utility
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach decoded payload (user info) to request
    req.user = decoded;

    // Continue request
    next();
  } catch (error) {
    logger.error("JWT verification failed:", error.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

/**
 * Middleware to check if authenticated user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized - Authentication required" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }

  next();
};

/**
 * Middleware to check if user has specific permission
 * @param {string} permissionKey - The permission key to check (e.g., 'dashboard', 'orders')
 */
const hasPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized - Authentication required" });
      }

      // Admin always has all permissions
      if (req.user.role === "admin") {
        return next();
      }

      // Check if user has the required permission
      const { getUserPermissions } = require("../models/admin/userModel");
      const permissions = await getUserPermissions(req.user.id);
      const permissionKeys = permissions.map(p => p.key);

      if (!permissionKeys.includes(permissionKey)) {
        return res.status(403).json({ 
          error: `Access denied. Required permission: ${permissionKey}` 
        });
      }

      next();
    } catch (error) {
      logger.error("Permission check failed:", error.message);
      return res.status(500).json({ error: "Server error" });
    }
  };
};

module.exports = { 
  authenticate, 
  requireAdmin,
  hasPermission
};