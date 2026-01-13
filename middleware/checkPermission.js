// middleware/checkPermission.js
const logger = require("../config/logger");

/**
 * Middleware to check if user has required permission
 * @param {string} requiredPermission
 */
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // ✅ Admin bypass
      if (user.role?.toLowerCase() === "admin") {
        return next();
      }

      // ✅ Permissions MUST come from authenticate middleware
      const permissions = user.permissions || [];

      if (permissions.includes(requiredPermission)) {
        return next();
      }

      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to access this resource",
        requiredPermission,
      });
    } catch (err) {
      logger.error("checkPermission error", {
        message: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: "Server error" });
    }
  };
};

module.exports = checkPermission;
