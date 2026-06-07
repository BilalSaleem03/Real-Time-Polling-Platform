const express = require("express");
const route = express.Router();
const authController = require("../controllers/auth");
const isLoggedIn = require("../middleware/auth");

// Public routes
route.post("/register", authController.register);  // Handles both new & existing tenants
route.post("/login", authController.login);

// Protected routes
route.get("/me", isLoggedIn, authController.getMe);
route.get("/tenant-users", isLoggedIn, authController.getTenantUsers); // Admin only

module.exports = route;