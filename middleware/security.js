const helmet = require("helmet");
const xss = require("xss-clean");
const cookieParser = require("cookie-parser");
const cors = require("cors");
// const csurf = require("csurf");

module.exports = (app) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:81",
    "http://localhost:82",
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(xss());
  app.use(cookieParser());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // ✅ Enable CSRF protection using cookies
  // app.use(
  //   csurf({
  //     cookie: {
  //       httpOnly: true,
  //       sameSite: "strict",
  //       secure: process.env.NODE_ENV === "production",
  //     },
  //   })
  // );

  // // Optional: expose token for frontend
  // app.use((req, res, next) => {
  //   res.cookie("XSRF-TOKEN", req.csrfToken());
  //   next();
  // });
};
