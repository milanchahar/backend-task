const express = require("express");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(express.json()); // Essential to parse JSON bodies from req.body
app.use(cors());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Root route to serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const apiRoutes = require('./routes/apiRoutes');

// Use the Routes
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }

  console.log(`Server is running on port ${PORT}`);
});
