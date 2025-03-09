/* eslint-disable no-undef */
const dotEnv = require("dotenv");
dotEnv.config({ path: "./config.env" }); // Load environment variablesconst webpush = require("web-push");
// Required modules
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");

// Custom modules (routes, passport strategy, logger, etc.)
const authRouter = require("./routes/authRoute");
const profileRouter = require("./routes/profileRoute");
const reactionRouter = require("./routes/reactionRoute");
const contentRouter = require("./routes/contentRoute");
const commentRouter = require("./routes/commentRoute");
const friendRouter = require("./routes/friendRoute");
const chatRouter = require("./routes/chatRoute");
const googleAuthRouter = require("./routes/googleAuthRoute");

const notificationRouter = require("./routes/notificationRoute");
const jwt = require("jsonwebtoken");
const User = require("./model/userModel");

// Configurations
const app = express();
const mongoUri = process.env.MONGO_URI;

app.use(express.json());
app.use(cookieParser());

// Security and CORS
app.use(helmet());
app.use(
  cors({
    origin: [`https://${process.env.CLIENT_URL}`, "http://localhost:5173", "http://localhost:4173"],
    // origin: "http://localhost:4173",
    credentials: true,
    exposedHeaders: ["X-Total-Count"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);
// ----------------------------------
// API Routes
// ----------------------------------
app.use("/auth", authRouter);
app.use("/auth", googleAuthRouter);
app.use("/profile", profileRouter);
app.use("/content", contentRouter);
app.use("/content", reactionRouter);
app.use("/comment", commentRouter);
app.use("/friend", friendRouter);
app.use("/notification", notificationRouter);
app.use("/chat", chatRouter);

app.get("/auth/check-session", async (req, res) => {
  const { token } = req.cookies;
  console.log(token);
  let decodedInfo = null;
  if (token) {
    decodedInfo = jwt.verify(token, process.env.JWT_SECRET_KEY);
  }

  const userId = decodedInfo?.id;
  const user = await User.findById(userId);

  if (user) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

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
    origin: [`https://${process.env.CLIENT_URL}`, "http://localhost:5173", "http://localhost:4173"],
    // origin: "http://localhost:4173",
    credentials: true,
  },
  pingTimeout: 60000,
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

require("./socketHandler")(io);
