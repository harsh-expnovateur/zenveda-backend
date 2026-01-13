// controllers/admin/authController.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { signAccessToken, signRefreshToken } = require("../../utils/jwt");
const {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserPassword,
  storeRefreshToken,
  findRefreshToken,
  markRefreshTokenUsed,
  revokeSession,
  getUserPermissions,
  rotateRefreshToken,
} = require("../../models/admin/userModel");
const logger = require("../../config/logger");

const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || "12");
const refreshTokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await findUserByEmail(email);
    if (existing)
      return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, saltRounds);
    const newUser = await createUser({ email, passwordHash: hashed, name });
    return res.status(201).json({
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    });
  } catch (err) {
    logger.error("register error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // 🚫 CHECK IF ACCOUNT IS DEACTIVATED
    if (!user.is_active) {
      return res.status(403).json({
        error:
          "Your account has been deactivated. Please contact the administrator.",
        isDeactivated: true,
      });
    }

    // Get user permissions
    const permissions = await getUserPermissions(user.id);
    const permissionKeys = permissions.map((p) => p.key);

    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
      permissions: permissionKeys,
    };

    const accessToken = signAccessToken(payload);
    // 🔐 SECURE REFRESH SESSION (NEW)
    const sessionId = crypto.randomUUID();
    const refreshToken = signRefreshToken({ id: user.id });

    const SESSION_DURATION_MS =
      parseInt(process.env.REFRESH_TOKEN_DURATION_MIN || "50") * 60 * 1000;
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const tokenHash = refreshTokenHash(refreshToken);
    await storeRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      sessionId,
    });

    // Set secure httpOnly cookie for refresh token
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Strict",
      path: "/api/auth/refresh",
      maxAge: SESSION_DURATION_MS,
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        permissions: permissionKeys,
      },
    });
  } catch (err) {
    logger.error("login error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ error: "Missing refresh token" });
    }

    const tokenHash = refreshTokenHash(token);
    const stored = await findRefreshToken(tokenHash);

    // ❌ Invalid / revoked token
    if (!stored || stored.revoked) {
      res.clearCookie("refreshToken");
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // 🚨 TOKEN REUSE ATTACK DETECTED
    if (stored.used) {
      await revokeSession(stored.session_id);
      res.clearCookie("refreshToken");
      return res.status(401).json({
        error: "Security violation detected. Session terminated.",
      });
    }

    // ⏳ ABSOLUTE SESSION EXPIRY
    if (new Date(stored.expires_at) < new Date()) {
      await revokeSession(stored.session_id);
      res.clearCookie("refreshToken");
      return res.status(401).json({ error: "Session expired" });
    }

    // 🔁 ROTATE TOKEN (ONE-TIME USE)
    const newRefreshToken = signRefreshToken({ id: stored.user_id });

    await rotateRefreshToken({
      sessionId: stored.session_id,
      newTokenHash: refreshTokenHash(newRefreshToken),
      expiresAt: stored.expires_at,
    });

    const remainingMs = new Date(stored.expires_at).getTime() - Date.now();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "Strict",
      path: "/api/auth/refresh",
      maxAge: remainingMs,
    });

    // ✅ NEW ACCESS TOKEN
    const user = await findUserById(stored.user_id);

    // 🚫 CHECK IF USER STILL ACTIVE (important for refresh)
    if (!user.is_active) {
      await revokeSession(stored.session_id);
      res.clearCookie("refreshToken");
      return res.status(403).json({
        error: "Account deactivated",
        isDeactivated: true,
      });
    }

    const permissions = await getUserPermissions(user.id);
    const permissionKeys = permissions.map((p) => p.key);

    const newAccessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissionKeys,
    });

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    logger.error("refresh error", err);
    res.status(401).json({ error: "Refresh failed" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (token) {
      const tokenIdHash = refreshTokenHash(token);
      const stored = await findRefreshToken(tokenIdHash);
      if (stored) {
        // Revoke the entire session
        await revokeSession(stored.session_id);
      }
    }
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out" });
  } catch (err) {
    logger.error("logout error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

const me = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user permissions
    const permissions = await getUserPermissions(user.id);
    const permissionKeys = permissions.map((p) => p.key);

    // Don't expose password hash
    delete user.password_hash;

    res.json({
      user: {
        ...user,
        permissions: permissionKeys,
      },
    });
  } catch (err) {
    logger.error("me error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (newPassword.length < 5 || newPassword.length > 12) {
      return res.status(400).json({
        error: "Password must be between 5 and 12 characters long",
      });
    }

    const user = await findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔑 Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    // 🔐 Hash new password
    const hashed = await bcrypt.hash(newPassword, saltRounds);

    await updateUserPassword({
      userId,
      passwordHash: hashed,
    });

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    logger.error("changePassword error", err);
    res.status(500).json({ error: "Server error" });
  }
};


module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword
};
