const express = require("express");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(express.json()); // Essential to parse JSON bodies from req.body
app.use(cors());

// Use the Auth Routes
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }

  console.log(`Server is running on port ${PORT}`);
});
