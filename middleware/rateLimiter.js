// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

const createRateLimiter = () => {
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || "15");
  const max = parseInt(process.env.RATE_LIMIT_MAX || "10");

  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests, please try again later."
    }
  });
};

module.exports = createRateLimiter;
