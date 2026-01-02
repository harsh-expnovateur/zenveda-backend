// utils/mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // use STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true, // Enable connection pooling for better performance
  maxConnections: 5, // Max concurrent connections
  maxMessages: 100, // Max messages per connection
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

/**
 * Send email (non-blocking, returns immediately)
 */
async function sendEmail({ to, subject, html }) {
  return transporter
    .sendMail({
      from: `"Zenveda" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    .then((info) => {
      console.log("✅ Email sent:", info.messageId);
      return info;
    })
    .catch((error) => {
      console.error("❌ Email send failed:", error.message);
      throw error;
    });
}
module.exports = { sendEmail };