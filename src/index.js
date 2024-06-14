require("dotenv").config();
const express = require("express");
const fs = require("fs");
const https = require("https");
const multer = require("multer");
const path = require("path");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");

const connectDB = require("./config/mongodb.config");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const youtubeRoutes = require("./routes/youtubeRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const userRoutes = require("./routes/userRoutes");

const errorHandler = require("./middlewares/errorHandler");
const sessionMiddleware = require("./middlewares/session"); // Ensure correct import
const logoutIfExpired = require("./middlewares/logoutIfExpired");

const app = express();

connectDB();

const allowedOrigins = [
  "http://localhost:3000", // Development frontend URL
  "https://yteditor.vercel.app", // Production frontend URL
];

// CORS options
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use compression middleware
app.use(compression());

// Use cookie parser middleware
app.use(cookieParser());

// Your other middleware and routes
app.use(express.json());
app.use(sessionMiddleware); // Use session middleware directly
// app.use(logoutIfExpired);

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/users", userRoutes);
app.use(errorHandler);



const httpsOptions = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
};

app.get("/", (req, res) => res.send("Hello"));

const server = http.createServer(app);
const PORT = process.env.PORT || 3699;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
