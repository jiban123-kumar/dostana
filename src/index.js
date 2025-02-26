/* eslint-disable no-undef */
const dotEnv = require("dotenv");
dotEnv.config({ path: "./config.env" }); // Load environment variables

// Required modules
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const MongoStore = require("connect-mongo");

// Custom modules (routes, passport strategy, logger, etc.)
const authRouter = require("./routes/authRoute");
const profileRouter = require("./routes/profileRoute");
const reactionRouter = require("./routes/reactionRoute");
const contentRouter = require("./routes/contentRoute");
const commentRouter = require("./routes/commentRoute");
const friendRouter = require("./routes/friendRoute");
const chatRouter = require("./routes/chatRoute");

const notificationRouter = require("./routes/notificationRoute");
const { googleOauthStartegy } = require("./passportStrategy/googleStrategy");

// Configurations
const app = express();
const mongoUri = process.env.MONGO_URI;

// ----------------------------------
// Middleware
// ----------------------------------

// Parse incoming JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Security and CORS
app.use(helmet());
app.use(
  cors({
    origin: `https://${process.env.CLIENT_URL}`,
    credentials: true,
    exposedHeaders: ["X-Total-Count"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI, // your MongoDB connection URI
      ttl: 14 * 24 * 60 * 60, // = 14 days. Adjust as needed.
    }),
  })
);

// Initialize Passport and Google OAuth strategy
googleOauthStartegy();

app.use(passport.initialize());
app.use(passport.session());

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  console.log(user);
  done(null, user);
});
passport.deserializeUser((user, done) => {
  console.log(user);
  done(null, user);
});

// ----------------------------------
// API Routes
// ----------------------------------
app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/content", contentRouter);
app.use("/content", reactionRouter);
app.use("/comment", commentRouter);
app.use("/friend", friendRouter);
app.use("/notification", notificationRouter);
app.use("/chat", chatRouter);

// Undefined routes handler
app.use((req, res, next) => {
  res.status(404).json({
    error: "The requested API endpoint is not defined.",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    const errors = Object.keys(err.errors).map((key) => err.errors[key].message);
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors,
    });
  }
  console.error(err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ message: err.message || "Internal server error" });
});

// ----------------------------------
// MongoDB Connection
// ----------------------------------
mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// ----------------------------------
// Start the Server & Socket.IO
// ----------------------------------
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {});

// Create the Socket.IO server
const io = new Server(server, {
  cors: {
    origin: `https://${process.env.CLIENT_URL}`,
    credentials: true,
  },
  pingTimeout: 60000,
});

// Load and initialize socket handlers
require("./socketHandler")(io);
