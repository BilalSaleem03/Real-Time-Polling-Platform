const express = require("express");
const route = express.Router();
const isLoggedIn = require("../middleware/auth");
const voteController = require("../controllers/vote");
const { voteRateLimiter } = require("../middleware/rateLimiter");

route.use(isLoggedIn);

// Apply vote rate limiter
route.post("/", voteRateLimiter, voteController.submitVote);
route.get("/check/:pollId", voteController.checkUserVote);

module.exports = route;