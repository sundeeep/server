const express = require("express");
const axios = require("axios");
const qs = require("qs");
const fs = require("fs");
const https = require("https");
const multer = require("multer");
const path = require("path");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require('cors');
const compression = require('compression');



const app = express();

const allowedOrigins = [
  "http://localhost:3000", // Development frontend URL
  "https://ytcollab.vercel.app", // Production frontend URL
];


// CORS options
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Use compression middleware
app.use(compression());

// Use cookie parser middleware
app.use(cookieParser());

// Your other middleware and routes
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});


const upload = multer({ dest: "uploads/" });


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const httpsOptions = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
};

const server = http.createServer(app);
server.listen(3699, () => {
  console.log("Server started on port 3699");
});
