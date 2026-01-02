// config/logger.js
const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: "info", // this controls the *lowest* level that gets logged globally
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // ✅ Error-level logs (only 'error')
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error", // 👈 this ensures only error-level logs go here
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),

    // ✅ Info-level and below (info, warn, etc.)
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      level: "info", // 👈 only info and above
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// ✅ Also log to console in dev mode
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    })
  );
}

module.exports = logger;
