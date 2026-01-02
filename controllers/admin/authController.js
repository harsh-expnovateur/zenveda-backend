// controllers/authController.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../../utils/jwt");
const {
  createUser,
  findUserByEmail,
  findUserById,
  storeRefreshToken,
  findRefreshToken,
  deleteRefreshTokenById
} = require("../../models/admin/userModel");
const logger = require("../../config/logger");

const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || "12");
const refreshTokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, saltRounds);
    const newUser = await createUser({ email, passwordHash: hashed, name });
    return res.status(201).json({ user: { id: newUser.id, email: newUser.email, name: newUser.name } });
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

    const payload = { id: user.id, role: user.role, email: user.email };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ id: user.id });

    // store hashed refresh token with expiry
    const decodedRefresh = verifyRefreshToken(refreshToken);
    const expiresAt = new Date(decodedRefresh.exp * 1000);

    const tokenHash = refreshTokenHash(refreshToken);
    await storeRefreshToken({ userId: user.id, tokenHash, expiresAt });

    // Set secure httpOnly cookie for refresh token
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Strict",
      maxAge: 1000 * 60 * 60 * 24 * 7 // align with refresh expiry (7 days)
    });

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    logger.error("login error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) return res.status(401).json({ error: "Missing refresh token" });

    // verify token signature
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const tokenHash = refreshTokenHash(token);
    const stored = await findRefreshToken(tokenHash);
    if (!stored) return res.status(401).json({ error: "Refresh token not recognized" });

    // Check expiry
    if (new Date(stored.expires_at) < new Date()) {
      await deleteRefreshTokenById(stored.id).catch(() => {});
      return res.status(401).json({ error: "Refresh token expired" });
    }

    const user = await findUserById(stored.user_id);
    if (!user) return res.status(401).json({ error: "User not found" });

    const payload = { id: user.id, role: user.role, email: user.email };
    const newAccessToken = signAccessToken(payload);

    // Optionally rotate refresh tokens (recommended)
    await deleteRefreshTokenById(stored.id);

    const newRefreshToken = signRefreshToken({ id: user.id });
    const decodedNewRefresh = verifyRefreshToken(newRefreshToken);
    const expiresAt = new Date(decodedNewRefresh.exp * 1000);
    await storeRefreshToken({
      userId: user.id,
      tokenHash: refreshTokenHash(newRefreshToken),
      expiresAt
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Strict",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    logger.error("refresh error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (token) {
      const tokenIdHash = refreshTokenHash(token);
      const stored = await findRefreshToken(tokenIdHash);
      if (stored) await deleteRefreshTokenById(stored.id);
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
    res.json({ user });
  } catch (err) {
    logger.error("me error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me
};
